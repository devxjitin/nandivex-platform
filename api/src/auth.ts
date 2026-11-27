import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { config, isProd } from './config';
import { prisma } from './db';
import { isManagerRole } from './roles';

export const COOKIE = 'nvx_session';
const SESSION_HOURS = 12;

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

export function setSession(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: SESSION_HOURS * 3600 * 1000,
    path: '/',
  });
}

export const clearSession = (res: Response) => res.clearCookie(COOKIE, { path: '/' });

/** Public shape of a user. Never includes the password hash. */
export const toDto = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status === 'ACTIVE' ? 'active' : 'invited',
  mustChangePassword: u.mustChangePassword,
  createdAt: u.createdAt.toISOString(),
  lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  // Changes whenever the picture does; null when there is none.
  photoVersion: u.photoUpdatedAt ? u.photoUpdatedAt.getTime() : null,
});

/** Loads the signed-in user from the cookie. The user is read from the database on every request,
 *  so removing an account signs that person out immediately. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Please sign in.' });
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      clearSession(res);
      return res.status(401).json({ error: 'Please sign in.' });
    }
    req.user = user;
    return next();
  } catch {
    clearSession(res);
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

export function requireManager(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !isManagerRole(req.user.role)) {
    return res.status(403).json({ error: 'You do not have access to this.' });
  }
  return next();
}
