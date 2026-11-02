import { createHash, randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { collections } from './db.js';

// app_login: the one-time code that hands a Google sign-in from the phone's browser back to the Android app
export type TokenPurpose = 'verify_email' | 'reset_password' | 'app_login';

export interface TokenDoc {
  _id: ObjectId;
  userId: ObjectId;
  purpose: TokenPurpose;
  // Only a hash is stored, so a database leak does not reveal usable links
  tokenHash: string;
  // app_login only: hash of the secret the app keeps, so an intercepted code is useless on its own (PKCE)
  challenge?: string;
  expiresAt: Date;
  createdAt: Date;
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function newRawToken() {
  return randomBytes(32).toString('base64url');
}

/** Creates a single-use token, replacing any earlier one for the same purpose */
export async function issueToken(userId: ObjectId, purpose: TokenPurpose, ttlMs: number, challenge?: string) {
  const { tokens } = await collections();
  const raw = newRawToken();
  await tokens.deleteMany({ userId, purpose });
  await tokens.insertOne({
    _id: new ObjectId(),
    userId,
    purpose,
    tokenHash: hashToken(raw),
    ...(challenge ? { challenge } : {}),
    expiresAt: new Date(Date.now() + ttlMs),
    createdAt: new Date(),
  });
  return raw;
}

/** The PKCE challenge for a secret: base64url of its SHA-256 */
export const pkceChallenge = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

/** Uses up an app sign-in code, but only together with the secret the app started with */
export async function consumeAppLogin(raw: string, verifier: string) {
  const { tokens } = await collections();
  const doc = await tokens.findOneAndDelete({
    tokenHash: hashToken(raw),
    purpose: 'app_login',
    challenge: pkceChallenge(verifier),
    expiresAt: { $gt: new Date() },
  });
  return doc?.userId ?? null;
}

/** Uses up a token; returns its user id, or null if it is unknown, used or expired */
export async function consumeToken(raw: string, purpose: TokenPurpose) {
  const { tokens } = await collections();
  const doc = await tokens.findOneAndDelete({ tokenHash: hashToken(raw), purpose, expiresAt: { $gt: new Date() } });
  return doc?.userId ?? null;
}
