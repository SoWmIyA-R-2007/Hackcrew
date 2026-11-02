import type { NextFunction, Request, Response } from 'express';
import { MongoServerError } from 'mongodb';
import { collections } from './db.js';
import { readSession } from './session.js';

/** At most `max` counted actions per `windowMs`; the count starts again when the window ends */
export interface Limit {
  name: string;
  max: number;
  windowMs: number;
}

export interface RateLimitDoc {
  _id: string;
  count: number;
  // When this window ends; a TTL index deletes the document soon after
  resetAt: Date;
}

export interface LimitResult {
  allowed: boolean;
  // Seconds until the window ends
  retryAfter: number;
}

const result = (doc: Pick<RateLimitDoc, 'count' | 'resetAt'> | null, max: number): LimitResult => ({
  allowed: !doc || doc.resetAt.getTime() <= Date.now() || doc.count <= max,
  retryAfter: doc ? Math.max(1, Math.ceil((doc.resetAt.getTime() - Date.now()) / 1000)) : 0,
});

/**
 * Counts one action and says whether it is still within the limit. Counts are kept in MongoDB, so they
 * survive restarts (Render's free plan sleeps and restarts the server) and are shared by every server process
 */
export async function hit(limit: Limit, id: string): Promise<LimitResult> {
  const { rateLimits } = await collections();
  const now = new Date();
  const windowOpen = { $gt: ['$resetAt', now] };
  // One atomic update: add to the current window, or start a new one if it has ended (or never existed)
  const update = [
    {
      $set: {
        count: { $cond: [windowOpen, { $add: ['$count', 1] }, 1] },
        resetAt: { $cond: [windowOpen, '$resetAt', new Date(now.getTime() + limit.windowMs)] },
      },
    },
  ];
  const key = `${limit.name}:${id}`;
  for (let attempt = 0; ; attempt++) {
    try {
      const doc = await rateLimits.findOneAndUpdate({ _id: key }, update, { upsert: true, returnDocument: 'after' });
      return result(doc, limit.max);
    } catch (err) {
      // Two first hits at the same moment both try to create the document; the second one retries as an update
      if (!(err instanceof MongoServerError && err.code === 11000) || attempt >= 2) throw err;
    }
  }
}

/** Whether the limit has already been used up, without counting anything */
export async function check(limit: Limit, id: string): Promise<LimitResult> {
  const { rateLimits } = await collections();
  const doc = await rateLimits.findOne({ _id: `${limit.name}:${id}` });
  // `max` actions were allowed; the next one is not
  return result(doc && { ...doc, count: doc.count + 1 }, limit.max);
}

export async function clear(limit: Limit, id: string) {
  const { rateLimits } = await collections();
  await rateLimits.deleteOne({ _id: `${limit.name}:${id}` });
}

/** "2 minutes", "1 hour" */
export function describeWait(seconds: number) {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

/** Answers 429 with a Retry-After header and a message that says how long to wait */
export function tooMany(res: Response, retryAfter: number, what = 'Too many attempts') {
  res.setHeader('Retry-After', String(retryAfter));
  res.status(429).json({ error: `${what}. Try again in ${describeWait(retryAfter)}.`, retryAfter });
}

export const clientIp = (req: Request) => req.ip ?? req.socket.remoteAddress ?? 'unknown';

/** Middleware: counts every request against the visitor's network address */
export function limitByIp(limit: Limit, what?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { allowed, retryAfter } = await hit(limit, clientIp(req));
    if (!allowed) {
      tooMany(res, retryAfter, what);
      return;
    }
    next();
  };
}

// --- Overall API limit ----------------------------------------------------

/*
 * A cap on all API requests, against scripts hammering the server. It runs on every request, so it is kept in
 * memory instead of costing a database write each time; a restart only gives a fresh allowance. Signed-in
 * people are counted per account, so a whole hackathon venue sharing one Wi-Fi address is not one bucket
 */
export const API_LIMIT = { max: 600, windowMs: 5 * 60 * 1000 };
const apiCounts = new Map<string, { count: number; resetAt: number }>();

export async function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const session = await readSession(req).catch(() => null);
  const key = session ? `user:${session.userId}` : `ip:${clientIp(req)}`;
  const now = Date.now();
  let entry = apiCounts.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + API_LIMIT.windowMs };
    apiCounts.set(key, entry);
  }
  entry.count++;
  if (entry.count > API_LIMIT.max) {
    tooMany(res, Math.ceil((entry.resetAt - now) / 1000), 'Too many requests');
    return;
  }
  next();
}

// Forget finished windows now and then, so the map does not grow forever
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of apiCounts) if (entry.resetAt <= now) apiCounts.delete(key);
}, 60 * 1000).unref();
