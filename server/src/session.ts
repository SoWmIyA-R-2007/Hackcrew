import { SignJWT, jwtVerify } from 'jose';
import type { CookieOptions, Request, Response } from 'express';
import { env } from './env.js';

export const SESSION_COOKIE = 'session';
const SESSION_DAYS = 7;

export interface SessionPayload {
  userId: string;
  // Must match the user's sessionVersion; bumping that number signs out every existing session
  version: number;
  expiresAt: string;
}

function getKey() {
  const secret = env.sessionSecret;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set to at least 32 characters. Add it to .env.local.');
  }
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getKey());
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ['HS256'] });
    if (typeof payload.userId !== 'string') return null;
    return {
      userId: payload.userId,
      version: typeof payload.version === 'number' ? payload.version : 0,
      expiresAt: String(payload.expiresAt),
    };
  } catch {
    return null;
  }
}

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax',
  path: '/',
};

export async function createSession(
  res: Response,
  user: { _id: { toHexString(): string }; sessionVersion?: number },
  expiresAt?: Date
) {
  const expires = expiresAt ?? new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const token = await encrypt({
    userId: user._id.toHexString(),
    version: user.sessionVersion ?? 0,
    expiresAt: expires.toISOString(),
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, expires });
}

export function deleteSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

export function readSession(req: Request) {
  return decrypt(req.cookies?.[SESSION_COOKIE]);
}
