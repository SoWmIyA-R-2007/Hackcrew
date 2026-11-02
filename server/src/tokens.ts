import { createHash, randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { collections } from './db.js';

export type TokenPurpose = 'verify_email' | 'reset_password';

export interface TokenDoc {
  _id: ObjectId;
  userId: ObjectId;
  purpose: TokenPurpose;
  // Only a hash is stored, so a database leak does not reveal usable links
  tokenHash: string;
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
export async function issueToken(userId: ObjectId, purpose: TokenPurpose, ttlMs: number) {
  const { tokens } = await collections();
  const raw = newRawToken();
  await tokens.deleteMany({ userId, purpose });
  await tokens.insertOne({
    _id: new ObjectId(),
    userId,
    purpose,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + ttlMs),
    createdAt: new Date(),
  });
  return raw;
}

/** Uses up a token; returns its user id, or null if it is unknown, used or expired */
export async function consumeToken(raw: string, purpose: TokenPurpose) {
  const { tokens } = await collections();
  const doc = await tokens.findOneAndDelete({ tokenHash: hashToken(raw), purpose, expiresAt: { $gt: new Date() } });
  return doc?.userId ?? null;
}
