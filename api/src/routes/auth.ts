import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { clearSession, requireAuth, setSession, toDto } from '../auth';
import { prisma } from '../db';
import { sendResetLinkEmail } from '../mail';
import { notify, notifyManagers } from '../notify';
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
  if (user.status === 'INVITED') {
    await notifyManagers({ type: 'first_signin', title: `${user.name} signed in for the first time`, link: `/admin/employees/${user.id}` }, user.id);
  }
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
  await notify([me.id], { type: 'password_changed', title: 'Your password was changed', body: 'If this was not you, tell an admin right away.' });
  return res.json({ user: toDto(updated) });
});

// --- Forgot password -------------------------------------------------------------------------

const RESET_MINUTES = 30;
// Ask again no sooner than this, so the form cannot be used to flood someone's inbox.
const RESET_COOLDOWN_MS = 60 * 1000;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

const forgotBody = z.object({ email: z.string().trim().toLowerCase().email() });

// Tells the person when there is no account for the address, so a typo is caught straight away.
// The rate limit above keeps this from being used to scan for addresses.
authRouter.post('/forgot-password', resetLimiter, async (req, res) => {
  const parsed = forgotBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address.' });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return res.status(404).json({ error: 'No account was found with this email address.' });

  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, usedAt: null, createdAt: { gt: new Date(Date.now() - RESET_COOLDOWN_MS) } },
  });
  if (recent) return res.status(429).json({ error: 'A reset link was just sent. Wait a minute before asking again.' });

  const token = randomBytes(32).toString('base64url');
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60 * 1000) },
    }),
  ]);
  try {
    await sendResetLinkEmail({ to: user.email, name: user.name, token, minutes: RESET_MINUTES });
  } catch (err) {
    console.error('forgot-password email failed', err);
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    return res.status(502).json({ error: 'We could not send the email right now. Try again in a few minutes.' });
  }
  return res.json({ ok: true });
});

const resetBody = z.object({ token: z.string().min(20).max(200), newPassword: passwordSchema });

authRouter.post('/reset-password', resetLimiter, async (req, res) => {
  const parsed = resetBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the new password and try again.' });
  }
  const { token, newPassword } = parsed.data;
  const invalid = { error: 'This reset link is not valid any more. Ask for a new one.' };

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return res.status(400).json(invalid);

  // Mark the link used first, and only continue if this request is the one that did it.
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return res.status(400).json(invalid);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);
  await notify([record.userId], { type: 'password_changed', title: 'Your password was changed', body: 'If this was not you, tell an admin right away.' });
  return res.json({ ok: true });
});
