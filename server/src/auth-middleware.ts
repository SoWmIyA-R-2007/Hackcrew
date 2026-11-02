import type { NextFunction, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { collections } from './db.js';
import { readSession } from './session.js';

/**
 * Rejects the request with 401 unless it carries a valid session for an existing account whose
 * session version still matches (so revoked sessions stop working); stores the user id on res.locals
 */
export function requireUser(message: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = await sessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: message });
      return;
    }
    res.locals.userId = userId;
    next();
  };
}

/** The signed-in user's id if the request has a valid, unrevoked session for an existing account */
export async function sessionUserId(req: Request): Promise<ObjectId | null> {
  const session = await readSession(req);
  if (!session || !ObjectId.isValid(session.userId)) return null;

  const userId = new ObjectId(session.userId);
  const { users } = await collections();
  const user = await users.findOne({ _id: userId }, { projection: { sessionVersion: 1 } });
  if (!user || (user.sessionVersion ?? 0) !== session.version) return null;
  return userId;
}

export function currentUserId(res: Response): ObjectId {
  return res.locals.userId as ObjectId;
}
