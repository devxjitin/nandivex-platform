import type { IncomingMessage } from 'node:http';
import express, { Router } from 'express';
import type { Request, RequestHandler, Response } from 'express';
import type { Prisma, Task, TaskItem, TaskSubmission, User } from '@prisma/client';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../auth';
import { prisma } from '../db';
import { getLinkPreview } from '../linkPreview';
import { notify, notifyManagers } from '../notify';
import { isAdminRole, isManagerRole } from '../roles';

/* Tasks. Founders, Co-Founders and Admins give a task to anyone. The task is explained with items (text, links,
   files) and the assignee hands in proof the same way. A manager other than the assignee then approves it, or
   rejects it with a reason, and the assignee adds proof again. */

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_ITEMS = 20;

/** File types that may be uploaded. Nothing that a browser would run as a page (HTML, SVG, scripts). */
const FILE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg',
  'application/pdf', 'text/plain', 'text/csv', 'application/zip',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
/** Shown in the browser itself; everything else downloads. */
const INLINE = (type: string) => /^(image|audio|video)\//.test(type) || type === 'application/pdf';

const isManager = (u: User) => isManagerRole(u.role);

type TaskWithPeople = Task & {
  assignee: Pick<User, 'id' | 'name' | 'role' | 'photoUpdatedAt'>;
  createdBy: Pick<User, 'id' | 'name'> | null;
};
const PEOPLE = {
  assignee: { select: { id: true, name: true, role: true, photoUpdatedAt: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const taskDto = (t: TaskWithPeople) => ({
  id: t.id,
  title: t.title,
  description: t.description ?? '',
  status: t.status.toLowerCase(),
  dueDate: dateOnly(t.dueDate),
  assignee: { id: t.assignee.id, name: t.assignee.name, role: t.assignee.role, photoVersion: t.assignee.photoUpdatedAt ? t.assignee.photoUpdatedAt.getTime() : null },
  createdBy: t.createdBy ? { id: t.createdBy.id, name: t.createdBy.name } : null,
  createdAt: t.createdAt.toISOString(),
  completedAt: t.completedAt ? t.completedAt.toISOString() : null,
});

const itemDto = (i: TaskItem) => ({
  id: i.id,
  kind: i.kind.toLowerCase(),
  text: i.text ?? '',
  url: i.url ?? '',
  fileName: i.fileName ?? '',
  contentType: i.contentType ?? '',
  size: i.size ?? 0,
  createdAt: i.createdAt.toISOString(),
});

type SubmissionWithReviewer = TaskSubmission & { reviewedBy: Pick<User, 'name'> | null; items: TaskItem[] };
const submissionDto = (s: SubmissionWithReviewer) => ({
  id: s.id,
  attempt: s.attempt,
  note: s.note ?? '',
  submittedAt: s.submittedAt.toISOString(),
  decision: s.decision ? s.decision.toLowerCase() : null,
  reviewNote: s.reviewNote ?? '',
  reviewedBy: s.reviewedBy?.name ?? null,
  reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
  items: s.items.map(itemDto),
});

/** Loads the task if this person may see it (managers see all, everyone else only their own); otherwise answers 404. */
async function load(req: Request, res: Response, db: Prisma.TransactionClient = prisma): Promise<TaskWithPeople | null> {
  const id = String(req.params.id);
  const task = await db.task.findUnique({ where: { id }, include: PEOPLE });
  if (!task || (!isManager(req.user!) && task.assigneeId !== req.user!.id)) {
    res.status(404).json({ error: 'Task not found.' });
    return null;
  }
  return task;
}

function mutation(handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { void handler(req, res).catch(next); };
}

// Serialize proof changes, hand-in, and review for the same task.
function withTaskLock<T>(req: Request, res: Response, change: (db: Prisma.TransactionClient, task: TaskWithPeople) => Promise<T>) {
  return prisma.$transaction(async (db) => {
    await db.$queryRaw`SELECT "id" FROM "Task" WHERE "id" = ${String(req.params.id)} FOR UPDATE`;
    const task = await load(req, res, db);
    return task ? change(db, task) : null;
  });
}

async function fullDto(task: TaskWithPeople) {
  const [items, submissions] = await Promise.all([
    prisma.taskItem.findMany({ where: { taskId: task.id, OR: [{ role: 'BRIEF' }, { submissionId: null }] }, orderBy: { createdAt: 'asc' } }),
    prisma.taskSubmission.findMany({
      where: { taskId: task.id },
      orderBy: { attempt: 'asc' },
      include: { reviewedBy: { select: { name: true } }, items: { orderBy: { createdAt: 'asc' } } },
    }),
  ]);
  return {
    ...taskDto(task),
    reviewVersion: task.updatedAt.toISOString(),
    brief: items.filter((i) => i.role === 'BRIEF').map(itemDto),
    draft: items.filter((i) => i.role === 'PROOF').map(itemDto),
    submissions: submissions.map(submissionDto),
  };
}

// --- Create, list, read -------------------------------------------------------------------------

const title = z.string().trim().min(2, 'Give the task a title of at least 2 characters.').max(120, 'Keep the title under 120 characters.');
const description = z.string().trim().max(4000, 'Keep the description under 4000 characters.');
const dueDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid due date.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Pick a valid due date.');

function requireManagerHere(req: Request, res: Response): boolean {
  if (isManager(req.user!)) return true;
  res.status(403).json({ error: 'Only a Founder, Co-Founder or Admin can do this.' });
  return false;
}

tasksRouter.get('/', async (req, res) => {
  const where: Prisma.TaskWhereInput = isManager(req.user!) ? {} : { assigneeId: req.user!.id };
  const rows = await prisma.task.findMany({ where, include: PEOPLE, orderBy: { createdAt: 'desc' }, take: 1000 });
  res.json({ tasks: rows.map(taskDto) });
});

tasksRouter.post('/', async (req, res) => {
  if (!requireManagerHere(req, res)) return;
  const parsed = z
    .object({ title, description: description.optional().default(''), assigneeId: z.string().min(1, 'Choose who this task is for.'), dueDate: dueDate.nullish() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' });
  const d = parsed.data;
  const assignee = await prisma.user.findUnique({ where: { id: d.assigneeId }, select: { id: true, role: true } });
  if (!assignee) return res.status(400).json({ error: 'That person was not found.' });
  if (isAdminRole(assignee.role)) return res.status(400).json({ error: 'Tasks cannot be given to an Admin.' });
  const task = await prisma.task.create({
    data: {
      title: d.title,
      description: d.description || null,
      assigneeId: assignee.id,
      createdById: req.user!.id,
      dueDate: d.dueDate ? new Date(`${d.dueDate}T00:00:00Z`) : null,
    },
    include: PEOPLE,
  });
  if (assignee.id !== req.user!.id) {
    await notify([assignee.id], { type: 'task_assigned', title: 'New task for you', body: task.title, link: `/tasks/${task.id}` });
  }
  return res.status(201).json({ task: taskDto(task) });
});

tasksRouter.get('/:id', async (req, res) => {
  const task = await load(req, res);
  if (!task) return;
  res.json({ task: await fullDto(task) });
});

tasksRouter.patch('/:id', async (req, res) => {
  if (!requireManagerHere(req, res)) return;
  const task = await load(req, res);
  if (!task) return;
  const parsed = z.object({ title, description, dueDate: dueDate.nullable() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' });
  const d = parsed.data;
  const saved = await prisma.task.update({
    where: { id: task.id },
    data: { title: d.title, description: d.description || null, dueDate: d.dueDate ? new Date(`${d.dueDate}T00:00:00Z`) : null },
    include: PEOPLE,
  });
  res.json({ task: await fullDto(saved) });
});

tasksRouter.delete('/:id', async (req, res) => {
  if (!requireManagerHere(req, res)) return;
  const task = await load(req, res);
  if (!task) return;
  await prisma.task.delete({ where: { id: task.id } });
  res.status(204).end();
});

// --- Items: the explanation (brief) and the proof ----------------------------------------------

type ItemScope = Pick<TaskItem, 'taskId' | 'role' | 'submissionId'>;

async function itemScope(req: Request, res: Response, db: Prisma.TransactionClient, task: TaskWithPeople): Promise<ItemScope | null> {
  const role = req.query.role === 'proof' ? 'PROOF' : req.query.role === 'brief' ? 'BRIEF' : null;
  if (!role) { res.status(400).json({ error: 'Say whether this is for the task or for the proof.' }); return null; }
  if (task.status === 'APPROVED') { res.status(409).json({ error: 'This task is already approved.' }); return null; }
  if (role === 'BRIEF') {
    if (!isManager(req.user!)) { res.status(403).json({ error: 'Only a Founder, Co-Founder or Admin can change the task.' }); return null; }
    return { taskId: task.id, role, submissionId: null };
  }
  if (task.assigneeId !== req.user!.id) { res.status(403).json({ error: 'Only the person the task is for can change proof.' }); return null; }
  const submissionId = req.query.submissionId;
  if (task.status !== 'SUBMITTED' && submissionId === undefined) return { taskId: task.id, role, submissionId: null };
  if (task.status === 'SUBMITTED' && typeof submissionId === 'string') {
    const latest = await db.taskSubmission.findFirst({ where: { taskId: task.id }, orderBy: { attempt: 'desc' }, select: { id: true, decision: true } });
    if (latest?.id === submissionId && latest.decision === null) return { taskId: task.id, role, submissionId };
  }
  res.status(409).json({ error: 'The proof status changed. Reopen the task to see the latest version.' });
  return null;
}

function changeItems<T>(req: Request, res: Response, change: (db: Prisma.TransactionClient, scope: ItemScope) => Promise<T | null>) {
  return withTaskLock(req, res, async (db, task) => {
    const scope = await itemScope(req, res, db, task);
    if (!scope) return null;
    const result = await change(db, scope);
    if (result !== null && scope.submissionId) {
      const updatedAt = new Date(Math.max(Date.now(), task.updatedAt.getTime() + 1));
      await db.task.update({ where: { id: task.id }, data: { updatedAt } });
    }
    return result;
  });
}

async function checkRoom(db: Prisma.TransactionClient, scope: ItemScope, res: Response): Promise<boolean> {
  const count = await db.taskItem.count({ where: scope });
  if (count >= MAX_ITEMS) { res.status(400).json({ error: `You can add up to ${MAX_ITEMS} items.` }); return false; }
  return true;
}

const textItem = z.object({ kind: z.literal('text'), text: z.string().trim().min(1, 'Write something first.').max(4000, 'Keep each text under 4000 characters.') });
const linkItem = z.object({
  kind: z.literal('link'),
  url: z.string().trim().max(500, 'That link is too long.').refine((v) => {
    try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; }
  }, 'Enter a full link that starts with http:// or https://'),
});

tasksRouter.post('/link-preview', rateLimit({
  windowMs: 60_000,
  limit: 60,
  keyGenerator: (req) => req.user!.id,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
}), mutation(async (req, res) => {
  const parsed = linkItem.safeParse({ kind: 'link', url: req.body?.url });
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid link.' });
  res.json({ preview: await getLinkPreview(parsed.data.url) });
}));

tasksRouter.post('/:id/items', mutation(async (req, res) => {
  const parsed = z.discriminatedUnion('kind', [textItem, linkItem]).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check what you entered.' });
  const d = parsed.data;
  const item = await changeItems(req, res, async (db, scope) => {
    if (!(await checkRoom(db, scope, res))) return null;
    return db.taskItem.create({ data: d.kind === 'text' ? { ...scope, kind: 'TEXT', text: d.text } : { ...scope, kind: 'LINK', url: d.url } });
  });
  if (item) res.status(201).json({ item: itemDto(item) });
}));

tasksRouter.patch('/:id/items/:itemId', mutation(async (req, res) => {
  const parsed = z.discriminatedUnion('kind', [textItem, linkItem]).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check what you entered.' });
  const d = parsed.data;
  const item = await changeItems(req, res, async (db, scope) => {
    const kind = d.kind === 'text' ? 'TEXT' : 'LINK';
    const id = String(req.params.itemId);
    const current = await db.taskItem.findFirst({ where: { ...scope, id, kind }, select: { id: true } });
    if (!current) { res.status(404).json({ error: 'Item not found.' }); return null; }
    return db.taskItem.update({ where: { id }, data: d.kind === 'text' ? { text: d.text } : { url: d.url } });
  });
  if (item) res.json({ item: itemDto(item) });
}));

const allowedFile = (req: IncomingMessage) => FILE_TYPES.has(String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase());

tasksRouter.put('/:id/files/:itemId?', express.raw({ type: allowedFile, limit: MAX_FILE_BYTES }), mutation(async (req, res) => {
  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    return res.status(400).json({ error: 'That file type is not supported. Use an image, audio, video, PDF, text, Office document or zip file.' });
  }
  const contentType = String(req.headers['content-type']).split(';')[0].trim().toLowerCase();
  const fileName = String(req.query.name ?? 'file').replace(/[\\/\r\n"]/g, '_').trim().slice(0, 120) || 'file';
  const data = { fileName, contentType, size: body.length };
  const bytes = new Uint8Array(body);
  const itemId = req.params.itemId;
  const item = await changeItems(req, res, async (db, scope) => {
    if (itemId) {
      const current = await db.taskItem.findFirst({ where: { ...scope, id: itemId, kind: 'FILE' }, select: { id: true } });
      if (!current) { res.status(404).json({ error: 'File not found.' }); return null; }
      return db.taskItem.update({ where: { id: itemId }, data: { ...data, file: { upsert: { create: { data: bytes }, update: { data: bytes } } } } });
    }
    if (!(await checkRoom(db, scope, res))) return null;
    return db.taskItem.create({ data: { ...scope, ...data, kind: 'FILE', file: { create: { data: bytes } } } });
  });
  if (item) res.status(itemId ? 200 : 201).json({ item: itemDto(item) });
}));

tasksRouter.delete('/:id/items/:itemId', mutation(async (req, res) => {
  const removed = await changeItems(req, res, async (db, scope) => {
    const where = { ...scope, id: String(req.params.itemId) };
    if (!(await db.taskItem.findFirst({ where, select: { id: true } }))) {
      res.status(404).json({ error: 'Item not found.' });
      return null;
    }
    if (scope.submissionId && await db.taskItem.count({ where: scope }) <= 1) {
      res.status(409).json({ error: 'Keep at least one item in submitted proof.' });
      return null;
    }
    await db.taskItem.delete({ where: { id: where.id } });
    return true;
  });
  if (removed) res.status(204).end();
}));

tasksRouter.get('/:id/items/:itemId/file', async (req, res) => {
  const task = await load(req, res);
  if (!task) return;
  const item = await prisma.taskItem.findFirst({ where: { id: String(req.params.itemId), taskId: task.id, kind: 'FILE' }, include: { file: true } });
  if (!item?.file || !item.contentType) return res.status(404).json({ error: 'File not found.' });
  const data = Buffer.from(item.file.data);
  const type = item.contentType;
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `${INLINE(type) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(item.fileName ?? 'file')}`);
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Accept-Ranges', 'bytes');
  // Audio and video players ask for slices so they can skip ahead.
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, data.length - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
    if (start > end || start >= data.length) {
      res.setHeader('Content-Range', `bytes */${data.length}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${data.length}`);
    return res.send(data.subarray(start, end + 1));
  }
  return res.send(data);
});

// --- Hand in proof, review ---------------------------------------------------------------------

const proofNote = z.string().trim().max(1000, 'Keep the note under 1000 characters.');

tasksRouter.patch('/:id/proof-note', mutation(async (req, res) => {
  const parsed = z.object({ note: proofNote }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the note.' });
  if (req.query.role !== 'proof' || typeof req.query.submissionId !== 'string') return res.status(400).json({ error: 'Choose the proof submission to edit.' });
  const { note } = parsed.data;
  const saved = await changeItems(req, res, async (db, scope) => {
    if (!scope.submissionId) return null;
    return db.taskSubmission.update({ where: { id: scope.submissionId }, data: { note: note || null }, select: { id: true } });
  });
  if (saved) res.json({ note });
}));

tasksRouter.post('/:id/submit', mutation(async (req, res) => {
  const parsed = z.object({ note: proofNote.optional().default('') }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the note.' });
  const saved = await withTaskLock(req, res, async (db, task) => {
    if (task.assigneeId !== req.user!.id) { res.status(403).json({ error: 'Only the person the task is for can hand in proof.' }); return null; }
    if (task.status !== 'PENDING' && task.status !== 'REJECTED') { res.status(409).json({ error: 'This task is not waiting for proof.' }); return null; }
    const draft = await db.taskItem.findMany({ where: { taskId: task.id, role: 'PROOF', submissionId: null }, select: { id: true } });
    if (draft.length === 0) { res.status(400).json({ error: 'Add some proof first: text, a link or a file.' }); return null; }
    const attempts = await db.taskSubmission.count({ where: { taskId: task.id } });
    await db.taskSubmission.create({
      data: { taskId: task.id, attempt: attempts + 1, note: parsed.data.note || null, items: { connect: draft.map((i) => ({ id: i.id })) } },
    });
    return db.task.update({ where: { id: task.id }, data: { status: 'SUBMITTED', completedAt: null }, include: PEOPLE });
  });
  if (!saved) return;
  await notifyManagers({ type: 'task_submitted', title: `${req.user!.name} handed in proof`, body: saved.title, link: `/tasks/${saved.id}` }, req.user!.id);
  res.json({ task: await fullDto(saved) });
}));

tasksRouter.post('/:id/review', mutation(async (req, res) => {
  if (!requireManagerHere(req, res)) return;
  const parsed = z
    .object({ decision: z.enum(['approve', 'reject']), note: proofNote.optional().default(''), reviewVersion: z.string().datetime() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the decision.' });
  const { decision, note, reviewVersion } = parsed.data;
  if (decision === 'reject' && !note) return res.status(400).json({ error: 'Tell them what is missing, so they know what to add.' });
  const approved = decision === 'approve';
  const saved = await withTaskLock(req, res, async (db, task) => {
    if (task.assigneeId === req.user!.id) { res.status(403).json({ error: 'Someone else has to review your own task.' }); return null; }
    if (task.status !== 'SUBMITTED') { res.status(409).json({ error: 'There is no proof waiting for a decision.' }); return null; }
    if (task.updatedAt.toISOString() !== reviewVersion) { res.status(409).json({ error: 'The task changed. Check the latest proof before reviewing.' }); return null; }
    const latest = await db.taskSubmission.findFirst({ where: { taskId: task.id }, orderBy: { attempt: 'desc' } });
    if (!latest || latest.decision) { res.status(409).json({ error: 'There is no proof waiting for a decision.' }); return null; }
    await db.taskSubmission.update({
      where: { id: latest.id },
      data: { decision: approved ? 'APPROVED' : 'REJECTED', reviewNote: note || null, reviewedById: req.user!.id, reviewedAt: new Date() },
    });
    return db.task.update({ where: { id: task.id }, data: { status: approved ? 'APPROVED' : 'REJECTED', completedAt: approved ? new Date() : null }, include: PEOPLE });
  });
  if (!saved) return;
  await notify([saved.assigneeId], {
    type: approved ? 'task_approved' : 'task_rejected',
    title: approved ? 'Your task was approved' : 'Your task needs more proof',
    body: approved ? saved.title : `${saved.title}: ${note}`,
    link: `/tasks/${saved.id}`,
  });
  res.json({ task: await fullDto(saved) });
}));
