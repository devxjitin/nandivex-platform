import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { CareerKind, CareerRole, CareerSettings, CareerStatus } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireManager } from '../auth';
import { prisma } from '../db';

/* The Careers page on nandivex.com. Managers edit it from the admin portal; the website reads the public
   endpoint, so a change shows up for visitors straight away. */

const KIND_IN = { Career: 'CAREER', Internship: 'INTERNSHIP' } as const;
const KIND_OUT: Record<CareerKind, 'Career' | 'Internship'> = { CAREER: 'Career', INTERNSHIP: 'Internship' };
const STATUS_IN = { open: 'OPEN', upcoming: 'UPCOMING', hidden: 'HIDDEN' } as const;
const STATUS_OUT: Record<CareerStatus, 'open' | 'upcoming' | 'hidden'> = { OPEN: 'open', UPCOMING: 'upcoming', HIDDEN: 'hidden' };
const MAX_ROLES = 100;

// --- Public: what visitors see ----------------------------------------------------------------

export const publicCareersRouter = Router();

/** Same shape the website's careers.json had, so the page needs no changes to show it. */
export function publicDto(settings: CareerSettings | null, roles: CareerRole[]) {
  return {
    statusTitle: settings?.statusTitle ?? '',
    statusText: settings?.statusText ?? '',
    openRoles: roles
      .filter((r) => r.status === 'OPEN')
      .map((r) => ({
        id: r.id,
        kind: KIND_OUT[r.kind],
        title: r.title,
        department: r.department ?? '',
        location: r.location ?? '',
        type: r.type ?? '',
        experience: r.experience ?? '',
        overview: r.overview ?? '',
        responsibilities: r.responsibilities,
        requirements: r.requirements,
        // Google for Jobs needs the date a job was posted.
        postedAt: r.createdAt.toISOString(),
      })),
    upcoming: roles
      .filter((r) => r.status === 'UPCOMING')
      .map((r) => ({ kind: KIND_OUT[r.kind], title: r.title, blurb: r.blurb, skills: r.skills })),
  };
}

const byOrder = { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] };

publicCareersRouter.get('/', async (_req, res) => {
  const [settings, roles] = await Promise.all([
    prisma.careerSettings.findUnique({ where: { id: 1 } }),
    prisma.careerRole.findMany({ where: { status: { in: ['OPEN', 'UPCOMING'] } }, ...byOrder }),
  ]);
  // Short cache: edits reach visitors within a minute, and a burst of visits does not hit the database each time.
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.json(publicDto(settings, roles));
});

// "Join the list" on the Careers page. Open to the website's visitors, so it is rate limited and has a hidden
// field that only bots fill in.
const interestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
const interestBody = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(80, 'That name is too long.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(120),
  kind: z.enum(['Career', 'Internship']),
  area: z.string().trim().min(1, 'Choose an area.').max(80),
  links: z.string().trim().max(300, 'Keep the link under 300 characters.').optional().default(''),
  website: z.string().optional(), // honeypot
});

publicCareersRouter.post('/interest', interestLimiter, express.json({ limit: '10kb' }), async (req, res) => {
  const parsed = interestBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' });
  const { website, links, ...d } = parsed.data;
  if (website) return res.json({ ok: true }); // a bot: pretend it worked
  const data = { ...d, kind: KIND_IN[d.kind], links: links || null };
  await prisma.careerInterest.upsert({
    where: { email_kind_area: { email: data.email, kind: data.kind, area: data.area } },
    update: { name: data.name, links: data.links },
    create: data,
  });
  res.status(201).json({ ok: true });
});

// --- Managers: edit ---------------------------------------------------------------------------

export const careersRouter = Router();
careersRouter.use(requireAuth, requireManager);

const adminRole = (r: CareerRole) => ({
  id: r.id,
  kind: KIND_OUT[r.kind],
  status: STATUS_OUT[r.status],
  title: r.title,
  blurb: r.blurb,
  skills: r.skills,
  department: r.department ?? '',
  location: r.location ?? '',
  type: r.type ?? '',
  experience: r.experience ?? '',
  overview: r.overview ?? '',
  responsibilities: r.responsibilities,
  requirements: r.requirements,
  updatedAt: r.updatedAt.toISOString(),
});

const adminSettings = (s: CareerSettings | null) => ({ statusTitle: s?.statusTitle ?? '', statusText: s?.statusText ?? '' });

const audit = (actorId: string, targetId: string, action: string) =>
  prisma.auditLog.create({ data: { actorId, targetId, action } });

careersRouter.get('/', async (_req, res) => {
  const [settings, roles] = await Promise.all([prisma.careerSettings.findUnique({ where: { id: 1 } }), prisma.careerRole.findMany(byOrder)]);
  res.json({ settings: adminSettings(settings), roles: roles.map(adminRole) });
});

const settingsBody = z.object({
  statusTitle: z.string().trim().min(3, 'Enter a title.').max(120, 'Keep the title under 120 characters.'),
  statusText: z.string().trim().min(3, 'Enter the message.').max(500, 'Keep the message under 500 characters.'),
});

careersRouter.put('/settings', async (req, res) => {
  const parsed = settingsBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the details and try again.' });
  const saved = await prisma.careerSettings.upsert({ where: { id: 1 }, create: { id: 1, ...parsed.data }, update: parsed.data });
  await audit(req.user!.id, 'careers', 'careers_edit_settings');
  return res.json({ settings: adminSettings(saved) });
});

/** A list of short text items, each trimmed; empty ones are dropped. */
const items = (what: string, max: number, itemMax: number) =>
  z
    .array(z.string().trim().max(itemMax, `Keep each ${what} under ${itemMax} characters.`))
    .max(max, `At most ${max} ${what}s.`)
    .transform((xs) => xs.filter(Boolean));
const optionalText = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`).default('');

const roleBody = z
  .object({
    kind: z.enum(['Career', 'Internship']),
    status: z.enum(['open', 'upcoming', 'hidden']),
    title: z.string().trim().min(2, 'Enter the role title.').max(80, 'Keep the title under 80 characters.'),
    blurb: z.string().trim().min(10, 'Add a short description (at least 10 characters).').max(300, 'Keep the description under 300 characters.'),
    skills: items('skill', 12, 40),
    department: optionalText(60),
    location: optionalText(60),
    type: optionalText(40),
    experience: optionalText(40),
    overview: optionalText(2000),
    responsibilities: items('item', 15, 300).default([]),
    requirements: items('item', 15, 300).default([]),
  })
  .superRefine((r, ctx) => {
    // A role that is shown as open needs everything the page prints for it.
    if (r.status !== 'open') return;
    const need = (path: string, ok: boolean, message: string) => { if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message }); };
    need('department', !!r.department, 'An open role needs a department.');
    need('location', !!r.location, 'An open role needs a location.');
    need('type', !!r.type, 'An open role needs a type, like Full-time.');
    need('experience', !!r.experience, 'An open role needs the experience level.');
    need('overview', r.overview.length >= 20, 'An open role needs an overview (at least 20 characters).');
    need('responsibilities', r.responsibilities.length > 0, 'An open role needs at least one responsibility.');
    need('requirements', r.requirements.length > 0, 'An open role needs at least one requirement.');
  });

const roleData = (r: z.infer<typeof roleBody>) => ({
  kind: KIND_IN[r.kind],
  status: STATUS_IN[r.status],
  title: r.title,
  blurb: r.blurb,
  skills: r.skills,
  department: r.department || null,
  location: r.location || null,
  type: r.type || null,
  experience: r.experience || null,
  overview: r.overview || null,
  responsibilities: r.responsibilities,
  requirements: r.requirements,
});

careersRouter.post('/roles', async (req, res) => {
  const parsed = roleBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the details and try again.' });
  if ((await prisma.careerRole.count()) >= MAX_ROLES) return res.status(400).json({ error: `You can keep up to ${MAX_ROLES} roles.` });
  // New roles go to the end of the list.
  const last = await prisma.careerRole.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.careerRole.create({ data: { ...roleData(parsed.data), sortOrder: (last._max.sortOrder ?? -1) + 1 } });
  await audit(req.user!.id, created.id, 'careers_add_role');
  return res.status(201).json({ role: adminRole(created) });
});

// Putting the order before /roles/:id keeps "order" from being read as an id.
const orderBody = z.object({ ids: z.array(z.string().min(1)).min(1).max(MAX_ROLES) });

careersRouter.put('/roles/order', async (req, res) => {
  const parsed = orderBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Send the roles in the order you want.' });
  const { ids } = parsed.data;
  if (new Set(ids).size !== ids.length) return res.status(400).json({ error: 'Each role can appear only once.' });
  const existing = await prisma.careerRole.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (existing.length !== ids.length) return res.status(404).json({ error: 'One of those roles no longer exists.' });
  await prisma.$transaction(ids.map((id, i) => prisma.careerRole.update({ where: { id }, data: { sortOrder: i } })));
  await audit(req.user!.id, 'careers', 'careers_reorder');
  const roles = await prisma.careerRole.findMany(byOrder);
  return res.json({ roles: roles.map(adminRole) });
});

careersRouter.put('/roles/:id', async (req, res) => {
  const parsed = roleBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the details and try again.' });
  const existing = await prisma.careerRole.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Role not found.' });
  const saved = await prisma.careerRole.update({ where: { id: existing.id }, data: roleData(parsed.data) });
  await audit(req.user!.id, saved.id, 'careers_edit_role');
  return res.json({ role: adminRole(saved) });
});

careersRouter.delete('/roles/:id', async (req, res) => {
  const existing = await prisma.careerRole.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Role not found.' });
  await prisma.careerRole.delete({ where: { id: existing.id } });
  await audit(req.user!.id, existing.id, 'careers_delete_role');
  return res.status(204).end();
});

careersRouter.get('/interests', async (_req, res) => {
  const rows = await prisma.careerInterest.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 });
  res.json({
    interests: rows.map((r) => ({ id: r.id, name: r.name, email: r.email, kind: KIND_OUT[r.kind], area: r.area, links: r.links ?? '', createdAt: r.createdAt.toISOString() })),
  });
});

careersRouter.delete('/interests/:id', async (req, res) => {
  const existing = await prisma.careerInterest.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) return res.status(404).json({ error: 'Not found.' });
  await prisma.careerInterest.delete({ where: { id: existing.id } });
  await audit(req.user!.id, existing.id, 'careers_delete_interest');
  res.json({ ok: true });
});
