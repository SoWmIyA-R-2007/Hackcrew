import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { collections } from './db.js';
import type { UserDoc } from './models.js';

// Names that would clash with app pages and API routes, or invite impersonation
const RESERVED = new Set([
  'admin', 'administrator', 'api', 'app', 'auth', 'dashboard', 'demo', 'hackcrew', 'hacktrack', 'help', 'invite', 'login',
  'logout', 'me', 'moderator', 'null', 'profile', 'root', 'settings', 'signup', 'stats', 'support', 'system',
  'tasks', 'u', 'undefined', 'verify-email', 'www',
]);

/** Usernames are stored lower case, so "Kishore" and "kishore" are the same name */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/, 'Usernames are 3–30 letters, numbers or dashes, starting and ending with a letter or number')
  .refine((v) => !v.includes('--'), 'Usernames cannot contain two dashes in a row')
  .refine((v) => !RESERVED.has(v), 'That username is reserved. Try another.');

/** A valid starting point from a name or email, e.g. "Kishore K V" -> "kishore-k-v" */
export function usernameBase(seed: string) {
  const slug = seed
    .toLowerCase()
    .normalize('NFKD')
    // Drop accent marks so "Zoë" becomes "zoe" rather than "zo-e"
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/, '');
  const base = slug.length >= 3 ? slug : `${slug || 'user'}-hack`.replace(/^-/, '');
  return RESERVED.has(base) ? `${base}-1` : base;
}

export async function isUsernameTaken(username: string, exceptUserId?: UserDoc['_id']) {
  const { users } = await collections();
  const found = await users.findOne({ handle: username }, { projection: { _id: 1 } });
  return Boolean(found && !(exceptUserId && found._id.equals(exceptUserId)));
}

/** A free username based on the seed: the base itself, then base-2 … base-9, then base plus 4 random digits */
export async function freeUsername(seed: string) {
  const base = usernameBase(seed);
  const candidates = [base, ...Array.from({ length: 8 }, (_, i) => `${base}-${i + 2}`)];
  for (const name of candidates) if (!(await isUsernameTaken(name))) return name;
  for (;;) {
    const name = `${base}-${randomInt(1000, 10000)}`;
    if (!(await isUsernameTaken(name))) return name;
  }
}

const isDuplicateUsername = (err: unknown) =>
  (err as { code?: number; keyPattern?: Record<string, unknown> }).code === 11000 &&
  Boolean((err as { keyPattern?: Record<string, unknown> }).keyPattern?.handle);

/**
 * Inserts a new user with a username: the requested one if given (the caller has checked it is free),
 * otherwise one generated from their name. Retries if someone takes the same name at the same moment.
 */
export async function insertUserWithUsername(user: UserDoc, requested?: string) {
  const { users } = await collections();
  for (let attempt = 0; ; attempt++) {
    const handle = requested && attempt === 0 ? requested : await freeUsername(user.name || user.email.split('@')[0]);
    try {
      await users.insertOne({ ...user, handle });
      return { ...user, handle };
    } catch (err) {
      if (!isDuplicateUsername(err) || attempt >= 5) throw err;
      if (requested && attempt === 0) throw err;
    }
  }
}

/** Gives every account created before usernames existed a username based on its name */
export async function backfillUsernames() {
  const { users } = await collections();
  const missing = await users.find({ handle: { $exists: false } }, { projection: { name: 1, email: 1 } }).toArray();
  for (const u of missing) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const handle = await freeUsername(u.name || u.email.split('@')[0]);
        await users.updateOne({ _id: u._id, handle: { $exists: false } }, { $set: { handle } });
        break;
      } catch (err) {
        if (!isDuplicateUsername(err)) throw err;
      }
    }
  }
  return missing.length;
}

export { isDuplicateUsername };
