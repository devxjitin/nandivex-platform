import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager, toDto } from '../auth';
import { prisma } from '../db';
import { sendLoginEmail } from '../mail';
import { generatePassword, hashPassword, passwordSchema } from '../password';
import { MANAGER_ROLE_NAMES, canonicalRole, isManagerRole, roleKey, roleNameSchema } from '../roles';

export const employeesRouter = Router();
employeesRouter.use(requireAuth, requireManager);

employeesRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ employees: users.map(toDto) });
});

const createBody = z.object({
  name: z.string().trim().min(2, 'Enter the full name.').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  role: roleNameSchema.transform(canonicalRole),
  password: passwordSchema,
  mustChangePassword: z.boolean().default(true),
});

employeesRouter.post('/', async (req, res) => {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the details and try again.' });
  }
  const { name, email, role, password, mustChangePassword } = parsed.data;

  if (await prisma.user.findUnique({ where: { email } })) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  // Reuse the saved role (any capitalisation) or save the new one, so it appears in the list next time.
  const passwordHash = await hashPassword(password);
  const created = await prisma.$transaction(async (tx) => {
    const saved = await tx.role.upsert({ where: { nameKey: roleKey(role) }, update: {}, create: { name: role, nameKey: roleKey(role) } });
    return tx.user.create({ data: { name, email, role: saved.name, passwordHash, mustChangePassword } });
  });

  let emailSent = true;
  try {
    await sendLoginEmail({ to: email, name, role: created.role, password, mustChangePassword, reset: false });
  } catch (err) {
    emailSent = false;
    console.error('Login email failed', err);
  }
  return res.status(201).json({ employee: toDto(created), emailSent });
});

employeesRouter.post('/:id/reset-password', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'Employee not found.' });
  // Resetting your own password would sign you out with a password only the email knows.
  if (user.id === req.user!.id) return res.status(400).json({ error: 'You cannot reset your own password here.' });

  const password = generatePassword();

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: true },
  });

  let emailSent = true;
  try {
    await sendLoginEmail({ to: user.email, name: user.name, role: user.role, password, mustChangePassword: true, reset: true });
  } catch (err) {
    emailSent = false;
    console.error('Reset email failed', err);
  }
  return res.json({ emailSent });
});

employeesRouter.delete('/:id', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'Employee not found.' });
  if (user.id === req.user!.id) return res.status(400).json({ error: 'You cannot remove your own account.' });

  if (isManagerRole(user.role)) {
    const managers = await prisma.user.count({
      where: { OR: MANAGER_ROLE_NAMES.map((r) => ({ role: { equals: r, mode: 'insensitive' as const } })) },
    });
    if (managers <= 1) return res.status(400).json({ error: 'At least one admin must remain.' });
  }
  await prisma.user.delete({ where: { id: user.id } });
  return res.status(204).end();
});
