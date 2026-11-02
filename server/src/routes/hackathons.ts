import { Router, type Response } from 'express';
import { ObjectId, type Filter } from 'mongodb';
import { z } from 'zod';
import { collections } from '../db.js';
import { currentUserId, requireUser } from '../auth-middleware.js';
import {
  accessFilter,
  computeCompletion,
  hackathonInputSchema,
  hackathonUpdateSchema,
  toHackathonDocs,
  toHackathonView,
  type HackathonDoc,
} from '../models.js';
import { buildSampleHackathons } from '../sample-data.js';
import { buildCalendar } from '../calendar.js';
import { inviteEmail, teamUpdateEmail } from '../emails.js';
import { isDeliverable, sendMail } from '../mailer.js';
import { hashToken, newRawToken } from '../tokens.js';
import { areFriends, sendFriendRequest } from './friends.js';
import type { MyTask, TaskView } from '../../../client/src/lib/types.js';
import type { UserDoc } from '../models.js';

export const hackathonsRouter = Router();

hackathonsRouter.use(requireUser('Sign in to manage your hackathons.'));

const NOT_FOUND = 'Hackathon not found. It may have been deleted, or you are no longer on its team.';
const OWNER_ONLY = 'Only the person who added this hackathon can do that.';
const INVITE_DAYS = 14;
const TEAM_EMAIL_COOLDOWN_MS = 10 * 60 * 1000;

const importSchema = z.object({ hackathons: z.array(hackathonInputSchema).min(1).max(100) });
const taskPatchSchema = z.object({ completed: z.boolean() });
// Invite by email address, a friend by their account id, or anyone by username
const teammateSchema = z.union([
  z.object({
    name: z.string().trim().max(200).optional(),
    email: z.email('Enter a valid email address').trim().toLowerCase(),
    role: z.string().trim().min(1).max(100),
  }),
  z.object({
    friendId: z.string().regex(/^[a-f0-9]{24}$/, 'Unknown friend'),
    role: z.string().trim().min(1).max(100),
  }),
  z.object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .max(31)
      .transform((v) => v.replace(/^@/, ''))
      .refine((v) => v.length > 0, 'Enter a username'),
    role: z.string().trim().min(1).max(100),
  }),
]);
const teamEmailSchema = z.object({ note: z.string().trim().max(1000).default('') });

/** Filter matching the hackathon only if the signed-in user owns it or is a member */
function accessibleById(id: string, res: Response) {
  if (!ObjectId.isValid(id)) return null;
  return { _id: new ObjectId(id), ...accessFilter(currentUserId(res)) };
}

/** Matches the stored edit version; documents saved before versions existed count as version 0 */
function atVersion(version: number | undefined): Filter<HackathonDoc> {
  return !version ? { $or: [{ version: 0 }, { version: { $exists: false } }] } : { version };
}

function notFound(res: Response) {
  res.status(404).json({ error: NOT_FOUND });
}

/** One hackathon for the response, with the current username of every teammate who has joined */
async function fullView(doc: HackathonDoc, viewerId: ObjectId) {
  const view = toHackathonView(doc, viewerId);
  const accountOf = (o: (typeof view.operatives)[number]) => o.userId || o.invitedUserId || null;
  const ids = view.operatives.map(accountOf).filter((id): id is string => Boolean(id && ObjectId.isValid(id)));
  if (ids.length === 0) return view;
  const { users } = await collections();
  const found = await users
    .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }, { projection: { handle: 1 } })
    .toArray();
  const byId = new Map(found.map((u) => [u._id.toHexString(), u.handle ?? null]));
  return {
    ...view,
    operatives: view.operatives.map((o) => {
      const account = accountOf(o);
      return { ...o, username: account ? (byId.get(account) ?? null) : null };
    }),
  };
}

const viewFor = (res: Response) => (doc: HackathonDoc) => toHackathonView(doc, currentUserId(res));

/** Tasks may only point at people on the team; anything else becomes unassigned */
function cleanTasks(tasks: TaskView[], operatives: HackathonDoc['operatives']) {
  return tasks.map((t) => {
    const assignee = operatives.find((o) => o.id === t.assigneeId);
    return assignee
      ? { ...t, assigneeName: assignee.name, assigneeAvatar: assignee.avatar }
      : { ...t, assigneeId: null };
  });
}

// List every hackathon the user owns or was invited to
hackathonsRouter.get('/', async (_req, res) => {
  const { hackathons } = await collections();
  const docs = await hackathons.find(accessFilter(currentUserId(res))).sort({ createdAt: -1 }).toArray();
  res.json({ hackathons: docs.map(viewFor(res)) });
});

// Create a hackathon; the creator is added to the team list as the lead
hackathonsRouter.post('/', async (req, res) => {
  const parsed = hackathonInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: `Invalid hackathon: ${parsed.error.issues[0].message}` });
    return;
  }

  const userId = currentUserId(res);
  const { users, hackathons } = await collections();
  const user = await users.findOne({ _id: userId });
  const owner = {
    id: `op-${userId.toHexString()}`,
    name: user?.name ?? 'You',
    email: user?.isDemo ? '' : (user?.email ?? ''),
    role: 'Team lead',
    avatar: '',
    userId: userId.toHexString(),
    invitePending: false,
    joinedAt: new Date().toISOString(),
  };
  const operatives = [owner, ...parsed.data.operatives.filter((o) => o.id !== owner.id)];
  const [doc] = toHackathonDocs(
    [{ ...parsed.data, operatives, tasks: cleanTasks(parsed.data.tasks, operatives) }],
    userId,
    user?.expiresAt
  );
  await hackathons.insertOne(doc);
  res.status(201).json({ hackathon: await fullView(doc, userId) });
});

// Add several at once: hackathons saved in the browser before accounts existed
hackathonsRouter.post('/import', async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: `Could not import: ${parsed.error.issues[0].message}` });
    return;
  }
  const docs = toHackathonDocs(
    parsed.data.hackathons.map((h) => ({ ...h, tasks: cleanTasks(h.tasks, h.operatives) })),
    currentUserId(res)
  );
  const { hackathons } = await collections();
  await hackathons.insertMany(docs);
  res.status(201).json({ hackathons: docs.map(viewFor(res)) });
});

// Add the sample hackathons to the account (expiring with it if it is a demo account)
hackathonsRouter.post('/samples', async (_req, res) => {
  const { users, hackathons } = await collections();
  const user = await users.findOne({ _id: currentUserId(res) });
  const owner = user && { userId: user._id.toHexString(), name: user.name, email: user.isDemo ? '' : user.email };
  const docs = toHackathonDocs(buildSampleHackathons(owner ?? undefined), currentUserId(res), user?.expiresAt);
  await hackathons.insertMany(docs);
  res.status(201).json({ hackathons: docs.map(viewFor(res)) });
});

// Every key date of every hackathon, as one calendar file
hackathonsRouter.get('/calendar.ics', async (_req, res) => {
  const { hackathons } = await collections();
  const docs = await hackathons.find(accessFilter(currentUserId(res))).toArray();
  res
    .type('text/calendar; charset=utf-8')
    .attachment('hackcrew-deadlines.ics')
    .send(buildCalendar('Hackcrew deadlines', docs));
});

// Open tasks assigned to the signed-in user across all their hackathons
hackathonsRouter.get('/my-tasks', async (_req, res) => {
  const userId = currentUserId(res).toHexString();
  const { hackathons } = await collections();
  const docs = await hackathons.find(accessFilter(currentUserId(res))).toArray();
  const tasks: MyTask[] = docs.flatMap((doc) => {
    const h = toHackathonView(doc);
    const mine = new Set(h.operatives.filter((o) => o.userId === userId).map((o) => o.id));
    return h.tasks
      .filter((t) => t.assigneeId && mine.has(t.assigneeId))
      .map((t) => ({ ...t, hackathonId: h.id, hackathonTitle: h.title, hackathonDeadline: h.submissionDeadline }));
  });
  res.json({ tasks });
});

hackathonsRouter.get('/:id', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  const { hackathons } = await collections();
  const doc = filter && (await hackathons.findOne(filter));
  if (!doc) return notFound(res);
  res.json({ hackathon: await fullView(doc, currentUserId(res)) });
});

hackathonsRouter.get('/:id/calendar.ics', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  const { hackathons } = await collections();
  const doc = filter && (await hackathons.findOne(filter));
  if (!doc) return notFound(res);
  res
    .type('text/calendar; charset=utf-8')
    .attachment(`${doc.title.replace(/[^\w-]+/g, '-').slice(0, 60) || 'hackathon'}.ics`)
    .send(buildCalendar(doc.title, [doc]));
});

// Save edits. Fails with 409 and the latest version if a teammate saved changes in the meantime
hackathonsRouter.put('/:id', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter) return notFound(res);

  const parsed = hackathonUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: `Invalid hackathon: ${parsed.error.issues[0].message}` });
    return;
  }

  const { hackathons } = await collections();
  const current = await hackathons.findOne(filter);
  if (!current) return notFound(res);

  const { version, ...fields } = parsed.data;
  const tasks = cleanTasks(fields.tasks, current.operatives);
  const doc = await hackathons.findOneAndUpdate(
    // $and keeps the access check and the version check separate (both use $or)
    { $and: [filter, atVersion(version)] },
    {
      $set: { ...fields, tasks, completion: computeCompletion(tasks), updatedAt: new Date() },
      $inc: { version: 1 },
    },
    { returnDocument: 'after' }
  );
  if (!doc) {
    res.status(409).json({
      error: 'A teammate changed this hackathon while you were editing. The latest version has been loaded.',
      hackathon: await fullView(current, currentUserId(res)),
    });
    return;
  }
  res.json({ hackathon: await fullView(doc, currentUserId(res)) });
});

// Tick a task on or off without sending the whole hackathon, so teammates rarely collide
hackathonsRouter.patch('/:id/tasks/:taskId', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter) return notFound(res);
  const parsed = taskPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Send { "completed": true | false }.' });
    return;
  }

  const { hackathons } = await collections();
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await hackathons.findOne(filter);
    if (!current) return notFound(res);
    if (!current.tasks.some((t) => t.id === req.params.taskId)) {
      res.status(404).json({ error: 'That task no longer exists.' });
      return;
    }
    const tasks = current.tasks.map((t) => (t.id === req.params.taskId ? { ...t, completed: parsed.data.completed } : t));
    const doc = await hackathons.findOneAndUpdate(
      { $and: [filter, atVersion(current.version)] },
      { $set: { tasks, completion: computeCompletion(tasks), updatedAt: new Date() }, $inc: { version: 1 } },
      { returnDocument: 'after' }
    );
    if (doc) {
      res.json({ hackathon: await fullView(doc, currentUserId(res)) });
      return;
    }
  }
  res.status(409).json({ error: 'Too many teammates are editing right now. Try again.' });
});

hackathonsRouter.delete('/:id', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  const { hackathons, invites, projects } = await collections();
  const doc = filter && (await hackathons.findOne(filter));
  if (!doc) return notFound(res);
  if (!doc.ownerId.equals(currentUserId(res))) {
    res.status(403).json({ error: `${OWNER_ONLY} You can leave the team instead.` });
    return;
  }
  await hackathons.deleteOne({ _id: doc._id });
  await invites.deleteMany({ hackathonId: doc._id });
  // Projects built for it are kept, just no longer linked
  await projects.updateMany({ hackathonId: doc._id }, { $set: { hackathonId: null } });
  res.json({ ok: true });
});

// --- Team ------------------------------------------------------------------

/**
 * Adds an account to the team list as invited, with an invite they can accept in the app. When held, they
 * are not friends yet: the invite stays hidden from them (and no email is sent) until they accept the
 * friend request, see held-invites.ts
 */
async function inviteAccount(doc: HackathonDoc, inviter: UserDoc, target: UserDoc, role: string, held: boolean) {
  const { hackathons, invites } = await collections();
  const operative = {
    id: `op-${new ObjectId().toHexString()}`,
    name: target.name,
    email: '',
    role,
    avatar: '',
    userId: null,
    invitedUserId: target._id.toHexString(),
    invitePending: true,
    awaitingFriend: held,
    joinedAt: null,
  };
  const updated = await hackathons.findOneAndUpdate(
    { _id: doc._id },
    { $push: { operatives: operative }, $set: { updatedAt: new Date() }, $inc: { version: 1 } },
    { returnDocument: 'after' }
  );
  const token = newRawToken();
  await invites.insertOne({
    _id: new ObjectId(),
    hackathonId: doc._id,
    operativeId: operative.id,
    email: target.email,
    inviteeUserId: target._id,
    invitedBy: inviter._id,
    tokenHash: hashToken(token),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
    ...(held ? { waitingForFriendship: true } : {}),
  });
  const emailed = !held && isDeliverable(target.email) ? await sendMail(inviteEmail(target.email, inviter.name, doc, token)) : false;
  return { hackathon: updated!, emailed };
}

// Add someone to the team list and invite them to join on Hackcrew
hackathonsRouter.post('/:id/team', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter) return notFound(res);
  const parsed = teammateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const userId = currentUserId(res);
  const { users, hackathons, invites } = await collections();
  const doc = await hackathons.findOne(filter);
  if (!doc) return notFound(res);
  if (!doc.ownerId.equals(userId)) {
    res.status(403).json({ error: OWNER_ONLY });
    return;
  }
  const inviter = await users.findOne({ _id: userId });
  const { role } = parsed.data;

  // An account: a friend gets the invitation now; anyone else gets a friend request first, and the
  // invitation waits until they accept it. Their email is not shown to the team either way
  if ('friendId' in parsed.data || 'username' in parsed.data) {
    if (inviter?.isDemo) {
      res.status(403).json({ error: 'Demo accounts cannot invite people by account. Create an account to build a team.' });
      return;
    }
    const target =
      'friendId' in parsed.data
        ? await users.findOne({ _id: new ObjectId(parsed.data.friendId), isDemo: { $ne: true } })
        : await users.findOne({ handle: parsed.data.username, isDemo: { $ne: true } });
    if (!target) {
      res.status(404).json({ error: 'username' in parsed.data ? `No one has the username @${parsed.data.username}.` : 'That person was not found.' });
      return;
    }
    if (target._id.equals(userId)) {
      res.status(400).json({ error: "That's you. You are already on the team." });
      return;
    }
    let friends = await areFriends(userId, target._id);
    if (!friends && 'friendId' in parsed.data) {
      res.status(403).json({ error: 'You can only invite people on your friend list this way.' });
      return;
    }
    const hex = target._id.toHexString();
    if (doc.ownerId.equals(target._id) || doc.operatives.some((o) => o.userId === hex || o.invitedUserId === hex)) {
      res.status(409).json({ error: `${target.name} is already on the team.` });
      return;
    }
    // If they had already sent you a friend request, this accepts it and you are friends straight away
    if (!friends) friends = (await sendFriendRequest(userId, target._id)) === 'accepted';
    const { hackathon, emailed } = await inviteAccount(doc, inviter!, target, role, !friends);
    res.status(201).json({ hackathon: await fullView(hackathon, userId), emailed, awaitingFriend: !friends });
    return;
  }

  const { email } = parsed.data;
  if (doc.operatives.some((o) => o.email.toLowerCase() === email)) {
    res.status(409).json({ error: `${email} is already on the team.` });
    return;
  }
  const namePart = email.split('@')[0];
  const operative = {
    id: `op-${new ObjectId().toHexString()}`,
    name: parsed.data.name || namePart.charAt(0).toUpperCase() + namePart.slice(1),
    email,
    role,
    avatar: '',
    userId: null,
    invitePending: true,
    joinedAt: null,
  };

  const updated = await hackathons.findOneAndUpdate(
    { _id: doc._id },
    { $push: { operatives: operative }, $set: { updatedAt: new Date() }, $inc: { version: 1 } },
    { returnDocument: 'after' }
  );

  // Demo accounts can list teammates but never send email
  let emailed = false;
  if (!inviter?.isDemo && isDeliverable(email)) {
    const token = newRawToken();
    await invites.insertOne({
      _id: new ObjectId(),
      hackathonId: doc._id,
      operativeId: operative.id,
      email,
      invitedBy: userId,
      tokenHash: hashToken(token),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
    });
    emailed = await sendMail(inviteEmail(email, inviter?.name ?? 'A teammate', doc, token));
  }

  res.status(201).json({ hackathon: await fullView(updated!, userId), emailed });
});

// Remove someone from the team. The owner can remove anyone else; a member can remove only themselves (leave)
hackathonsRouter.delete('/:id/team/:operativeId', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter) return notFound(res);
  const userId = currentUserId(res);
  const { hackathons, invites } = await collections();
  const doc = await hackathons.findOne(filter);
  if (!doc) return notFound(res);

  const operative = doc.operatives.find((o) => o.id === req.params.operativeId);
  if (!operative) {
    res.status(404).json({ error: 'That person is no longer on the team.' });
    return;
  }
  const isOwner = doc.ownerId.equals(userId);
  const isSelf = operative.userId === userId.toHexString();
  if (operative.userId === doc.ownerId.toHexString()) {
    res.status(400).json({ error: 'The person who added the hackathon cannot be removed from its team.' });
    return;
  }
  if (!isOwner && !isSelf) {
    res.status(403).json({ error: OWNER_ONLY });
    return;
  }

  const tasks = doc.tasks.map((t) => (t.assigneeId === operative.id ? { ...t, assigneeId: null } : t));
  const updated = await hackathons.findOneAndUpdate(
    { _id: doc._id },
    {
      $pull: {
        operatives: { id: operative.id },
        ...(operative.userId && ObjectId.isValid(operative.userId) ? { memberIds: new ObjectId(operative.userId) } : {}),
      },
      $set: { tasks, updatedAt: new Date() },
      $inc: { version: 1 },
    },
    { returnDocument: 'after' }
  );
  await invites.deleteMany({ hackathonId: doc._id, operativeId: operative.id });
  res.json({ hackathon: isSelf ? null : await fullView(updated!, userId), left: isSelf });
});

// Email a status update to everyone on the team who has an account
hackathonsRouter.post('/:id/email-team', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter) return notFound(res);
  const parsed = teamEmailSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Keep the note under 1000 characters.' });
    return;
  }

  const userId = currentUserId(res);
  const { users, hackathons } = await collections();
  const sender = await users.findOne({ _id: userId });
  if (sender?.isDemo) {
    res.status(403).json({ error: 'Demo accounts cannot send email. Create an account to email your team.' });
    return;
  }

  // Claim the send slot atomically so double clicks or two teammates cannot spam the team
  const cutoff = new Date(Date.now() - TEAM_EMAIL_COOLDOWN_MS);
  const doc = await hackathons.findOneAndUpdate(
    { $and: [filter, { $or: [{ lastTeamEmailAt: { $exists: false } }, { lastTeamEmailAt: { $lt: cutoff } }] }] },
    { $set: { lastTeamEmailAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!doc) {
    const exists = await hackathons.findOne(filter, { projection: { _id: 1 } });
    if (!exists) return notFound(res);
    res.status(429).json({ error: 'The team was emailed less than 10 minutes ago. Try again a little later.' });
    return;
  }

  const recipients = await users
    .find({ _id: { $in: [doc.ownerId, ...doc.memberIds] }, isDemo: { $ne: true } }, { projection: { email: 1 } })
    .toArray();
  const to = recipients.map((u) => u.email).filter(isDeliverable);
  const sent = await sendMail(teamUpdateEmail(to, sender?.name ?? 'A teammate', doc, parsed.data.note));
  if (!sent) {
    await hackathons.updateOne({ _id: doc._id }, { $unset: { lastTeamEmailAt: '' } });
    res.status(502).json({ error: 'The email could not be sent. Check the email settings on the server.' });
    return;
  }
  res.json({ sent: to.length });
});
