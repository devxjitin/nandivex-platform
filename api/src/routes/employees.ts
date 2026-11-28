import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireManager, toDto } from '../auth';
import { decryptField } from '../crypto';
import { prisma } from '../db';
import { sendLoginEmail } from '../mail';
import { notify, notifyManagers } from '../notify';
import { generatePassword, hashPassword, passwordSchema } from '../password';
import { profileDto } from './profile';
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
});

employeesRouter.post('/', async (req, res) => {
  const parsed = createBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the details and try again.' });
  }
  const { name, email, role, password } = parsed.data;

  if (await prisma.user.findUnique({ where: { email } })) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  // Reuse the saved role (any capitalisation) or save the new one, so it appears in the list next time.
  const passwordHash = await hashPassword(password);
  const created = await prisma.$transaction(async (tx) => {
    const saved = await tx.role.upsert({ where: { nameKey: roleKey(role) }, update: {}, create: { name: role, nameKey: roleKey(role) } });
    return tx.user.create({ data: { name, email, role: saved.name, passwordHash, mustChangePassword: false } });
  });

  let emailSent = true;
  try {
    await sendLoginEmail({ to: email, name, role: created.role, password, mustChangePassword: false, reset: false });
  } catch (err) {
    emailSent = false;
    console.error('Login email failed', err);
  }
  await notifyManagers({ type: 'employee_added', title: `${created.name} was added`, body: `Role: ${created.role}`, link: `/admin/employees/${created.id}` }, req.user!.id, created.id);
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
    data: { passwordHash: await hashPassword(password), mustChangePassword: false },
  });

  let emailSent = true;
  try {
    await sendLoginEmail({ to: user.email, name: user.name, role: user.role, password, mustChangePassword: false, reset: true });
  } catch (err) {
    emailSent = false;
    console.error('Reset email failed', err);
  }
  await notify([user.id], { type: 'password_reset', title: 'Your password was reset', body: 'An admin set a new password for you. It was sent to your email.' });
  // Only managers reach this route. The password is returned once so the admin can pass it on if the email does not arrive.
  return res.json({ emailSent, password });
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
  await notifyManagers({ type: 'employee_removed', title: `${user.name} was removed`, body: `Removed by ${req.user!.name}` }, req.user!.id);
  return res.status(204).end();
});

// --- Everyone's details, for managers -------------------------------------------------------

employeesRouter.get('/:id/profile', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'Employee not found.' });
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  return res.json({ profile: profileDto(user, profile) });
});

employeesRouter.get('/:id/photo', async (req, res) => {
  const photo = await prisma.profilePhoto.findUnique({ where: { userId: req.params.id } });
  if (!photo) return res.status(404).json({ error: 'No picture yet.' });
  res.setHeader('Content-Type', photo.contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.send(Buffer.from(photo.data));
});

const revealBody = z.object({ field: z.enum(['pan', 'bankAccount']) });

// The full PAN and account number are only sent when a manager asks for them, and each request is recorded.
employeesRouter.post('/:id/profile/reveal', async (req, res) => {
  const parsed = revealBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose pan or bankAccount.' });
  const profile = await prisma.profile.findUnique({ where: { userId: req.params.id } });
  const stored = parsed.data.field === 'pan' ? profile?.panEnc : profile?.bankAccountEnc;
  if (!stored) return res.status(404).json({ error: 'Nothing saved yet.' });
  let value: string;
  try {
    value = decryptField(stored);
  } catch {
    return res.status(500).json({ error: 'Could not read this value.' });
  }
  await prisma.auditLog.create({
    data: { actorId: req.user!.id, targetId: req.params.id, action: `reveal_${parsed.data.field}` },
  });
  return res.json({ value });
});

// --- Account details, for managers -----------------------------------------------------------
// An admin sets a person's name, email and role. What the person fills in on their own profile (date of birth,
// address, PAN, bank details, picture) can only be changed by that person; managers can only read it.

const accountBody = z.object({
  name: z.string().trim().min(2, 'Enter the full name.').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  role: roleNameSchema.transform(canonicalRole),
});

const record = (req: { user?: { id: string } }, targetId: string, action: string) =>
  prisma.auditLog.create({ data: { actorId: req.user!.id, targetId, action } });

// Name, email and role: set by an admin, not editable by the employee.
employeesRouter.patch('/:id', async (req, res) => {
  const parsed = accountBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the details and try again.' });
  }
  const { name, email, role } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'Employee not found.' });

  if (email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) return res.status(409).json({ error: 'An account with this email already exists.' });
  }
  // Moving the last admin to a role without admin rights would leave nobody in charge.
  if (isManagerRole(user.role) && !isManagerRole(role)) {
    const managers = await prisma.user.count({
      where: { OR: MANAGER_ROLE_NAMES.map((r) => ({ role: { equals: r, mode: 'insensitive' as const } })) },
    });
    if (managers <= 1) return res.status(400).json({ error: 'At least one admin must remain.' });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.role.upsert({ where: { nameKey: roleKey(role) }, update: {}, create: { name: role, nameKey: roleKey(role) } });
    return tx.user.update({ where: { id: user.id }, data: { name, email, role: saved.name } });
  });
  await record(req, user.id, 'edit_account');
  return res.json({ employee: toDto(updated) });
});
