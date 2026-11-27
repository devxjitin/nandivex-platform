import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { clearSession, requireAuth, setSession, toDto } from '../auth';
import { prisma } from '../db';
import { burnVerify, hashPassword, passwordSchema, verifyPassword } from '../password';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in a few minutes.' },
});

const loginBody = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });

authRouter.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter your email and password.' });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await burnVerify(password);
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status: 'ACTIVE', lastLoginAt: new Date() },
  });
  setSession(res, updated.id);
  return res.json({ user: toDto(updated) });
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: toDto(req.user!) }));

authRouter.post('/logout', (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

const changeBody = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema });

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const parsed = changeBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the passwords and try again.' });
  }
  const me = req.user!;
  const { currentPassword, newPassword } = parsed.data;

  if (!(await verifyPassword(me.passwordHash, currentPassword))) {
    return res.status(400).json({ error: 'Your current password is not correct.' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'Choose a password different from the current one.' });
  }
  const updated = await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
  });
  return res.json({ user: toDto(updated) });
});
