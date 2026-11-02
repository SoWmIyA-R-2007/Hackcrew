import { Router } from 'express';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { collections } from '../db.js';
import { createSession, deleteSession } from '../session.js';
import { currentUserId, requireUser, sessionUserId } from '../auth-middleware.js';
import { toHackathonDocs, toPublicUser, type UserDoc } from '../models.js';
import { buildSampleHackathons, buildSampleProject } from '../sample-data.js';
import { linkGoogleToUser, signInWithGoogleProfile } from '../google-account.js';
import { env } from '../env.js';
import { sendMail } from '../mailer.js';
import { passwordResetEmail, verificationEmail } from '../emails.js';
import { consumeToken, issueToken } from '../tokens.js';
import { insertUserWithUsername, isDuplicateUsername, isUsernameTaken, usernameSchema } from '../usernames.js';

export const authRouter = Router();

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  password: z.string().min(8, 'Use at least 8 characters for your password').max(200),
  // Optional: one is made from the name when it is left out
  username: usernameSchema.optional(),
});

// "login" is an email or a username; "email" is still accepted from older clients
const loginSchema = z
  .object({
    login: z.string().trim().toLowerCase().max(320).optional(),
    email: z.string().trim().toLowerCase().max(320).optional(),
    password: z.string().min(1, 'Enter your password').max(200),
  })
  .transform(({ login, email, password }) => ({ login: login || email || '', password }))
  .refine((v) => v.login.length > 0, 'Enter your email or username');

authRouter.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { name, email, password, username } = parsed.data;
  const { users } = await collections();

  const existing = await users.findOne({ email });
  if (existing) {
    res.status(409).json({
      error: existing.passwordHash
        ? 'An account with this email already exists. Sign in instead.'
        : 'This email is linked to a Google account. Continue with Google instead.',
    });
    return;
  }
  if (username && (await isUsernameTaken(username))) {
    res.status(409).json({ error: `The username ${username} is taken. Try another.` });
    return;
  }

  let user: UserDoc = {
    _id: new ObjectId(),
    email,
    name,
    passwordHash: await bcrypt.hash(password, 12),
    // Nothing proves the person owns this address yet
    emailVerified: false,
    createdAt: new Date(),
  };
  try {
    user = await insertUserWithUsername(user, username);
  } catch (err) {
    if (!isDuplicateUsername(err)) throw err;
    res.status(409).json({ error: `The username ${username} is taken. Try another.` });
    return;
  }
  await createSession(res, user);
  await sendVerification(user);
  res.status(201).json({ user: toPublicUser(user) });
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { login, password } = parsed.data;
  const { users } = await collections();
  // "@name" and "name" are usernames; anything else with an @ is an email address
  const id = login.replace(/^@/, '');
  const user = await users.findOne(id.includes('@') ? { email: id } : { handle: id });

  if (user && !user.passwordHash) {
    res.status(400).json({ error: 'This account uses Google sign-in. Continue with Google instead.' });
    return;
  }
  if (!user || !(await bcrypt.compare(password, user.passwordHash!))) {
    res.status(401).json({ error: 'Email, username or password is incorrect.' });
    return;
  }

  await createSession(res, user);
  res.json({ user: toPublicUser(user) });
});

// --- Email verification and password reset ---------------------------------

const VERIFY_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
// Per-address limit on verification and reset emails, so the endpoints can't be used to flood an inbox
const EMAIL_LIMIT_PER_HOUR = 5;
const emailRequests = new Map<string, number[]>();

function allowEmailTo(address: string) {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const recent = (emailRequests.get(address) ?? []).filter((t) => t > hourAgo);
  if (recent.length >= EMAIL_LIMIT_PER_HOUR) return false;
  recent.push(Date.now());
  emailRequests.set(address, recent);
  return true;
}

async function sendVerification(user: UserDoc) {
  if (user.isDemo || user.emailVerified || !allowEmailTo(user.email)) return false;
  const token = await issueToken(user._id, 'verify_email', VERIFY_TTL_MS);
  return sendMail(verificationEmail(user.email, user.name, token));
}

const tokenSchema = z.object({ token: z.string().min(10).max(200) });
const resetSchema = z.object({
  token: z.string().min(10).max(200),
  newPassword: z.string().min(8, 'Use at least 8 characters for your new password').max(200),
});
const forgotSchema = z.object({ email: z.email('Enter a valid email address').trim().toLowerCase() });

// Send the verification link again
authRouter.post('/resend-verification', requireUser('Not signed in'), async (_req, res) => {
  const { users } = await collections();
  const user = await users.findOne({ _id: currentUserId(res) });
  if (!user || user.emailVerified) {
    res.json({ ok: true, alreadyVerified: Boolean(user?.emailVerified) });
    return;
  }
  if (!(await sendVerification(user))) {
    res.status(429).json({ error: 'A link was sent recently. Check your inbox or try again in an hour.' });
    return;
  }
  res.json({ ok: true });
});

// Confirm the email address from the link; works whether or not the person is signed in
authRouter.post('/verify-email', async (req, res) => {
  const parsed = tokenSchema.safeParse(req.body);
  const userId = parsed.success ? await consumeToken(parsed.data.token, 'verify_email') : null;
  if (!userId) {
    res.status(400).json({ error: 'This link is invalid, already used or expired. Sign in and use "Send the link again" at the top of the page.' });
    return;
  }
  const { users } = await collections();
  await users.updateOne({ _id: userId }, { $set: { emailVerified: true } });
  res.json({ ok: true });
});

// Always answers the same way, so it cannot be used to find out which emails have accounts
authRouter.post('/forgot-password', async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { users } = await collections();
  const user = await users.findOne({ email: parsed.data.email });
  if (user && !user.isDemo && allowEmailTo(user.email)) {
    const token = await issueToken(user._id, 'reset_password', RESET_TTL_MS);
    await sendMail(passwordResetEmail(user.email, user.name, token));
  }
  res.json({ ok: true });
});

// Set a new password from the emailed link. This also proves the email, and signs out every other session
authRouter.post('/reset-password', async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const userId = await consumeToken(parsed.data.token, 'reset_password');
  if (!userId) {
    res.status(400).json({ error: 'This reset link is invalid, already used or expired. Ask for a new one.' });
    return;
  }
  const { users, tokens } = await collections();
  const user = await users.findOneAndUpdate(
    { _id: userId },
    {
      $set: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12), emailVerified: true },
      $inc: { sessionVersion: 1 },
    },
    { returnDocument: 'after' }
  );
  if (!user) {
    res.status(400).json({ error: 'This account no longer exists.' });
    return;
  }
  await tokens.deleteMany({ userId, purpose: 'verify_email' });
  await createSession(res, user);
  res.json({ user: toPublicUser(user) });
});

// --- Demo sign-in ---------------------------------------------------------

const DEMO_HOURS = 24;
const DEMO_LIMIT_PER_HOUR = 30;
const demoRequests = new Map<string, number[]>();

/** Simple in-memory limit on demo accounts per IP, so the button can't be used to fill the database */
function allowDemo(ip: string) {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const recent = (demoRequests.get(ip) ?? []).filter((t) => t > hourAgo);
  if (recent.length >= DEMO_LIMIT_PER_HOUR) return false;
  recent.push(Date.now());
  demoRequests.set(ip, recent);
  return true;
}

// Signs the visitor into a private, throwaway account filled with sample hackathons
authRouter.post('/demo', async (req, res) => {
  if (!allowDemo(req.ip ?? 'unknown')) {
    res.status(429).json({ error: 'Too many demo sessions from this network. Try again in an hour.' });
    return;
  }

  const expiresAt = new Date(Date.now() + DEMO_HOURS * 60 * 60 * 1000);
  const draft: UserDoc = {
    _id: new ObjectId(),
    // Unique placeholder address; demo accounts cannot sign in with a password
    email: `demo-${randomBytes(6).toString('hex')}@demo.hacktrack.invalid`,
    name: 'Demo user',
    isDemo: true,
    expiresAt,
    createdAt: new Date(),
  };

  const { hackathons, projects } = await collections();
  const user = await insertUserWithUsername(draft);
  const sampleHackathons = toHackathonDocs(
    buildSampleHackathons({ userId: user._id.toHexString(), name: user.name, email: '' }),
    user._id,
    expiresAt
  );
  await hackathons.insertMany(sampleHackathons);
  await projects.insertOne(buildSampleProject(user._id, user.name, sampleHackathons[0]?._id ?? null, expiresAt));
  await createSession(res, user, expiresAt);
  res.status(201).json({ user: toPublicUser(user) });
});

authRouter.post('/logout', (_req, res) => {
  deleteSession(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireUser('Not signed in'), async (_req, res) => {
  const { users } = await collections();
  const user = await users.findOne({ _id: currentUserId(res) });
  if (!user) {
    // The account was deleted after the session was issued
    deleteSession(res);
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  res.json({ user: toPublicUser(user) });
});

// --- Profile --------------------------------------------------------------

const profileSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name').max(100).optional(),
    username: usernameSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.username !== undefined, 'Send a name or a username');

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(200),
  newPassword: z.string().min(8, 'Use at least 8 characters for your new password').max(200),
});

const deleteAccountSchema = z.object({
  // Typed by the user to confirm, checked against the account's email
  confirmEmail: z.string().trim().toLowerCase(),
  password: z.string().max(200).optional(),
});

// Update the display name and/or username
authRouter.patch('/me', requireUser('Not signed in'), async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { name, username } = parsed.data;
  if (username && (await isUsernameTaken(username, currentUserId(res)))) {
    res.status(409).json({ error: `The username ${username} is taken. Try another.` });
    return;
  }
  const { users } = await collections();
  let user: UserDoc | null;
  try {
    user = await users.findOneAndUpdate(
      { _id: currentUserId(res) },
      { $set: { ...(name !== undefined ? { name } : {}), ...(username ? { handle: username } : {}) } },
      { returnDocument: 'after' }
    );
  } catch (err) {
    if (!isDuplicateUsername(err)) throw err;
    res.status(409).json({ error: `The username ${username} is taken. Try another.` });
    return;
  }
  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  res.json({ user: toPublicUser(user) });
});

// Change the password; every other device is signed out, this one stays signed in
authRouter.post('/password', requireUser('Not signed in'), async (req, res) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { users } = await collections();
  const user = await users.findOne({ _id: currentUserId(res) });
  if (!user?.passwordHash) {
    res.status(400).json({ error: 'This account signs in with Google, so it has no password to change.' });
    return;
  }
  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    res.status(400).json({ error: 'Your current password is incorrect.' });
    return;
  }

  const updated = await users.findOneAndUpdate(
    { _id: user._id },
    { $set: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) }, $inc: { sessionVersion: 1 } },
    { returnDocument: 'after' }
  );
  await createSession(res, updated!);
  res.json({ user: toPublicUser(updated!) });
});

// Sign out every device, including this one
authRouter.post('/logout-all', requireUser('Not signed in'), async (_req, res) => {
  const { users } = await collections();
  await users.updateOne({ _id: currentUserId(res) }, { $inc: { sessionVersion: 1 } });
  deleteSession(res);
  res.json({ ok: true });
});

// Permanently delete the account and all of its hackathons
authRouter.delete('/me', requireUser('Not signed in'), async (req, res) => {
  const parsed = deleteAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Type your email address to confirm.' });
    return;
  }

  const { users, hackathons } = await collections();
  const user = await users.findOne({ _id: currentUserId(res) });
  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  // Demo accounts have a random placeholder email, so they confirm with the word "delete" instead
  const expected = user.isDemo ? 'delete' : user.email;
  if (parsed.data.confirmEmail !== expected) {
    res.status(400).json({
      error: user.isDemo ? 'Type "delete" to confirm.' : 'The email you typed does not match this account.',
    });
    return;
  }
  if (user.passwordHash && !(await bcrypt.compare(parsed.data.password ?? '', user.passwordHash))) {
    res.status(400).json({ error: 'Your password is incorrect.' });
    return;
  }

  const { friendships, invites, projects } = await collections();
  const hex = user._id.toHexString();
  await hackathons.deleteMany({ ownerId: user._id });
  // Leave other teams cleanly: off their member lists, and no longer shown as invited
  await hackathons.updateMany(
    { $or: [{ memberIds: user._id }, { 'operatives.invitedUserId': hex }] },
    { $pull: { memberIds: user._id, operatives: { invitedUserId: hex } }, $inc: { version: 1 } }
  );
  await projects.deleteMany({ ownerId: user._id });
  // Off other projects, with their cards left unassigned
  await projects.updateMany(
    { memberIds: user._id },
    {
      $pull: { memberIds: user._id, members: { userId: user._id } },
      $set: { 'tasks.$[t].assigneeId': null, 'tasks.$[t].assignedBy': null, 'tasks.$[t].assignedAt': null },
    },
    { arrayFilters: [{ 't.assigneeId': hex }] }
  );
  await projects.updateMany({ 'pendingInvites.userId': user._id }, { $pull: { pendingInvites: { userId: user._id } } });
  await friendships.deleteMany({ $or: [{ requesterId: user._id }, { addresseeId: user._id }] });
  await invites.deleteMany({ $or: [{ inviteeUserId: user._id }, { invitedBy: user._id }] });
  await users.deleteOne({ _id: user._id });
  deleteSession(res);
  res.json({ ok: true });
});

// Disconnect Google; only allowed while a password remains, so the account can still be signed in to
authRouter.delete('/google', requireUser('Not signed in'), async (_req, res) => {
  const { users } = await collections();
  const current = await users.findOne({ _id: currentUserId(res) });
  if (!current?.googleId) {
    res.status(400).json({ error: 'Google is not connected to this account.' });
    return;
  }
  const user = await users.findOneAndUpdate(
    { _id: current._id, passwordHash: { $exists: true }, googleId: { $exists: true } },
    { $unset: { googleId: '' } },
    { returnDocument: 'after' }
  );
  if (!user) {
    res.status(400).json({
      error: 'Google can only be disconnected from an account that also has a password, or you would be locked out.',
    });
    return;
  }
  res.json({ user: toPublicUser(user) });
});

// --- Google sign-in -------------------------------------------------------

const GOOGLE_STATE_COOKIE = 'google_oauth_state';
const GOOGLE_COOKIE_PATH = '/api/auth/google';

function googleConfig() {
  if (!env.googleClientId || !env.googleClientSecret) return null;
  return {
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    // Must exactly match an "Authorized redirect URI" on the Google OAuth client
    redirectUri: `${env.appUrl}/api/auth/google/callback`,
  };
}

interface GoogleUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

// Starts the Google flow: sign-in, or with ?link=1 connecting Google to the signed-in account
authRouter.get('/google', async (req, res) => {
  const linking = req.query.link === '1';
  const config = googleConfig();
  if (!config) {
    res.redirect(`${linking ? '/profile' : '/login'}?error=google_not_configured`);
    return;
  }

  // A link request is tied to the account that started it and is checked again on the way back
  let intent = 'signin';
  if (linking) {
    const userId = await sessionUserId(req);
    if (!userId) {
      res.redirect('/login');
      return;
    }
    intent = `link:${userId.toHexString()}`;
  }

  const state = randomBytes(24).toString('hex');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();

  res.cookie(GOOGLE_STATE_COOKIE, `${state}.${intent}`, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: GOOGLE_COOKIE_PATH,
    maxAge: 10 * 60 * 1000,
  });
  res.redirect(url.toString());
});

// Google redirects here after the user picks an account
authRouter.get('/google/callback', async (req, res) => {
  const stateCookie = String(req.cookies?.[GOOGLE_STATE_COOKIE] ?? '');
  const [expectedState, intent = ''] = stateCookie.split(/\.(.*)/s);
  const linkUserId = intent.startsWith('link:') ? intent.slice('link:'.length) : null;

  const fail = (reason: string) => {
    res.clearCookie(GOOGLE_STATE_COOKIE, { path: GOOGLE_COOKIE_PATH });
    res.redirect(`${linkUserId ? '/profile' : '/login'}?error=${reason}`);
  };

  const config = googleConfig();
  if (!config) return fail('google_not_configured');

  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const state = typeof req.query.state === 'string' ? req.query.state : null;
  if (!code || !state || !expectedState || state !== expectedState) return fail('google_failed');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail('google_failed');
    const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
    if (!accessToken) return fail('google_failed');

    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) return fail('google_failed');
    const profile = (await profileRes.json()) as GoogleUserInfo;
    if (!profile.sub || !profile.email || !profile.email_verified) return fail('google_unverified');

    const googleProfile = { sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture };

    if (linkUserId) {
      // Still signed in to the same account that asked to connect Google?
      const userId = await sessionUserId(req);
      if (!userId || userId.toHexString() !== linkUserId) return fail('google_failed');

      const linked = await linkGoogleToUser(userId, googleProfile);
      if ('error' in linked) return fail(linked.error);
      res.clearCookie(GOOGLE_STATE_COOKIE, { path: GOOGLE_COOKIE_PATH });
      res.redirect('/profile?google=connected');
      return;
    }

    const result = await signInWithGoogleProfile(googleProfile);
    if ('error' in result) return fail(result.error);

    await createSession(res, result.user);
    res.clearCookie(GOOGLE_STATE_COOKIE, { path: GOOGLE_COOKIE_PATH });
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    fail('google_failed');
  }
});
