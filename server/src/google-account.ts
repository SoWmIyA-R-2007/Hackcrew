import { ObjectId } from 'mongodb';
import { collections } from './db.js';
import type { UserDoc } from './models.js';
import { insertUserWithUsername } from './usernames.js';

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export type GoogleSignInResult = { user: UserDoc } | { error: 'google_conflict' };
export type GoogleLinkResult = { user: UserDoc } | { error: 'google_in_use' | 'google_already_connected' };

/**
 * Connects a Google account to an account the user is already signed in to.
 * Being signed in proves they own the account, so unlike signInWithGoogleProfile the password is kept.
 * The account's email counts as verified only if Google confirms that same address.
 */
export async function linkGoogleToUser(userId: ObjectId, profile: GoogleProfile): Promise<GoogleLinkResult> {
  const { users } = await collections();

  const owner = await users.findOne({ googleId: profile.sub });
  if (owner && !owner._id.equals(userId)) return { error: 'google_in_use' };

  const sameEmail = (u: UserDoc) => u.email === profile.email.toLowerCase();
  const user = await users.findOne({ _id: userId });
  if (!user) return { error: 'google_in_use' };
  if (owner) return { user };
  if (user.googleId) return { error: 'google_already_connected' };

  const updated = await users.findOneAndUpdate(
    { _id: userId, googleId: { $exists: false } },
    {
      $set: {
        googleId: profile.sub,
        ...(sameEmail(user) ? { emailVerified: true } : {}),
        ...(profile.picture ? { avatarUrl: profile.picture } : {}),
      },
    },
    { returnDocument: 'after' }
  );
  return updated ? { user: updated } : { error: 'google_already_connected' };
}

/**
 * Finds the account for a Google sign-in, linking or creating one as needed.
 * The profile's email must already be verified by Google.
 *
 * Password sign-up does not prove ownership of an email, so anyone could register someone else's
 * address before they arrive (and even connect their own Google account to it). When Google proves the
 * real owner, an unverified account with that email is handed over to them: its password and any other
 * Google link are removed and all of its existing sessions are signed out, so whoever created it loses access.
 */
export async function signInWithGoogleProfile(profile: GoogleProfile): Promise<GoogleSignInResult> {
  const email = profile.email.toLowerCase();
  const { users } = await collections();

  const linked = await users.findOne({ googleId: profile.sub });
  if (linked) return { user: linked };

  const existing = await users.findOne({ email });
  if (existing) {
    // An unverified account (password or another Google account linked to it) has not proven it owns
    // this email, so the Google account that does prove it takes it over. A verified one keeps its link.
    const claimFromUnverified = !existing.emailVerified;
    if (existing.googleId && !claimFromUnverified) return { error: 'google_conflict' };

    const user = await users.findOneAndUpdate(
      // Matching the current googleId makes concurrent sign-ins safe
      { _id: existing._id, googleId: existing.googleId ?? { $exists: false } },
      {
        $set: {
          googleId: profile.sub,
          emailVerified: true,
          ...(profile.picture ? { avatarUrl: profile.picture } : {}),
          // A name chosen by whoever registered the unverified account is not trusted either
          ...(claimFromUnverified && profile.name ? { name: profile.name } : {}),
        },
        ...(claimFromUnverified ? { $unset: { passwordHash: '' }, $inc: { sessionVersion: 1 } } : {}),
      },
      { returnDocument: 'after' }
    );
    return user ? { user } : { error: 'google_conflict' };
  }

  const user = await insertUserWithUsername({
    _id: new ObjectId(),
    email,
    name: profile.name || email.split('@')[0],
    googleId: profile.sub,
    emailVerified: true,
    avatarUrl: profile.picture,
    createdAt: new Date(),
  });
  return { user };
}
