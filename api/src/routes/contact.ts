import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { ContactMessage } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireManager } from '../auth';
import { prisma } from '../db';

/* The contact form on nandivex.com. Visitors post to the public endpoint; managers read and handle the messages
   from the admin portal. (The email to the team and the confirmation to the visitor are still sent by the
   Parakh API the website also posts to.) */

// --- Public: the website's form --------------------------------------------------------------

export const publicContactRouter = Router();

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages from this connection. Please try again later.' },
});

const optional = (max: number) => z.string().trim().max(max).optional().default('');
const body = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(80, 'That name is too long.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(120),
  phone: optional(30),
  company: optional(100),
  topic: optional(100),
  budget: optional(60),
  message: z.string().trim().min(10, 'Write a message of at least 10 characters.').max(4000, 'Keep the message under 4000 characters.'),
  website: z.string().optional(), // honeypot
});

publicContactRouter.post('/', limiter, express.json({ limit: '20kb' }), async (req, res) => {
  const parsed = body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' });
  const { website, phone, company, topic, budget, ...d } = parsed.data;
  if (website) return res.json({ ok: true }); // a bot: pretend it worked
  await prisma.contactMessage.create({ data: { ...d, phone: phone || null, company: company || null, topic: topic || null, budget: budget || null } });
  res.status(201).json({ ok: true });
});

// --- Managers --------------------------------------------------------------------------------

export const contactRouter = Router();
contactRouter.use(requireAuth, requireManager);

const dto = (m: ContactMessage) => ({
  id: m.id,
  name: m.name,
  email: m.email,
  phone: m.phone ?? '',
  company: m.company ?? '',
  topic: m.topic ?? '',
  budget: m.budget ?? '',
  message: m.message,
  status: m.status === 'DONE' ? 'done' : 'new',
  createdAt: m.createdAt.toISOString(),
});

const audit = (actorId: string, targetId: string, action: string) =>
  prisma.auditLog.create({ data: { actorId, targetId, action } });

contactRouter.get('/', async (_req, res) => {
  const rows = await prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 });
  res.json({ messages: rows.map(dto) });
});

contactRouter.patch('/:id', async (req, res) => {
  const parsed = z.object({ status: z.enum(['new', 'done']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a status.' });
  const existing = await prisma.contactMessage.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) return res.status(404).json({ error: 'Not found.' });
  const saved = await prisma.contactMessage.update({ where: { id: existing.id }, data: { status: parsed.data.status === 'done' ? 'DONE' : 'NEW' } });
  await audit(req.user!.id, saved.id, 'contact_set_status');
  res.json({ message: dto(saved) });
});

contactRouter.delete('/:id', async (req, res) => {
  const existing = await prisma.contactMessage.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) return res.status(404).json({ error: 'Not found.' });
  await prisma.contactMessage.delete({ where: { id: existing.id } });
  await audit(req.user!.id, existing.id, 'contact_delete');
  res.json({ ok: true });
});
