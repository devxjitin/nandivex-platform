import type { IncomingMessage } from 'node:http';
import express, { Router } from 'express';
import type { Request, Response } from 'express';
import type { Prisma, Task, TaskItem, TaskSubmission, User } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '../auth';
import { prisma } from '../db';
import { notify, notifyManagers } from '../notify';
import { isManagerRole } from '../roles';

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
async function load(req: Request, res: Response): Promise<TaskWithPeople | null> {
  const id = String(req.params.id);
  const task = await prisma.task.findUnique({ where: { id }, include: PEOPLE });
  if (!task || (!isManager(req.user!) && task.assigneeId !== req.user!.id)) {
    res.status(404).json({ error: 'Task not found.' });
    return null;
  }
  return task;
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
  const assignee = await prisma.user.findUnique({ where: { id: d.assigneeId }, select: { id: true } });
  if (!assignee) return res.status(400).json({ error: 'That person was not found.' });
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

/** Who may add to or remove from a list: managers the brief (until approved), the assignee the proof (while it is theirs to give). */
function listAccess(req: Request, res: Response, task: TaskWithPeople): 'BRIEF' | 'PROOF' | null {
  const role = req.query.role === 'proof' ? 'PROOF' : req.query.role === 'brief' ? 'BRIEF' : null;
  if (!role) { res.status(400).json({ error: 'Say whether this is for the task or for the proof.' }); return null; }
  if (task.status === 'APPROVED') { res.status(409).json({ error: 'This task is already approved.' }); return null; }
  if (role === 'BRIEF') {
    if (!isManager(req.user!)) { res.status(403).json({ error: 'Only a Founder, Co-Founder or Admin can change the task.' }); return null; }
    return role;
  }
  if (task.assigneeId !== req.user!.id) { res.status(403).json({ error: 'Only the person the task is for can add proof.' }); return null; }
  if (task.status === 'SUBMITTED') { res.status(409).json({ error: 'The proof is with a reviewer. Wait for the decision.' }); return null; }
  return role;
}

async function checkRoom(taskId: string, role: 'BRIEF' | 'PROOF', res: Response): Promise<boolean> {
  const count = await prisma.taskItem.count({ where: { taskId, role, submissionId: null } });
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

tasksRouter.post('/:id/items', async (req, res) => {
  const task = await load(req, res);
  if (!task) return;
  const role = listAccess(req, res, task);
  if (!role) return;
  const parsed = z.discriminatedUnion('kind', [textItem, linkItem]).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check what you entered.' });
  if (!(await checkRoom(task.id, role, res))) return;
  const d = parsed.data;
  const item = await prisma.taskItem.create({
    data: d.kind === 'text' ? { taskId: task.id, role, kind: 'TEXT', text: d.text } : { taskId: task.id, role, kind: 'LINK', url: d.url },
  });
  return res.status(201).json({ item: itemDto(item) });
});

const allowedFile = (req: IncomingMessage) => FILE_TYPES.has(String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase());

tasksRouter.put('/:id/files', express.raw({ type: allowedFile, limit: MAX_FILE_BYTES }), async (req, res) => {
  const task = await load(req, res);
  if (!task) return;
  const role = listAccess(req, res, task);
  if (!role) return;
  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    return res.status(400).json({ error: 'That file type is not supported. Use an image, audio, video, PDF, text, Office document or zip file.' });
  }
  if (!(await checkRoom(task.id, role, res))) return;
  const contentType = String(req.headers['content-type']).split(';')[0].trim().toLowerCase();
  const fileName = String(req.query.name ?? 'file').replace(/[\\/\r\n"]/g, '_').trim().slice(0, 120) || 'file';
  const item = await prisma.taskItem.create({
    data: { taskId: task.id, role, kind: 'FILE', fileName, contentType, size: body.length, file: { create: { data: new Uint8Array(body) } } },
  });
  return res.status(201).json({ item: itemDto(item) });
});

tasksRouter.delete('/:id/items/:itemId', async (req, res) => {
  const task = await load(req, res);
  if (!task) return;
  const role = listAccess(req, res, task);
  if (!role) return;
  // Proof that was already handed in stays as the record; only the current draft can be removed.
  const gone = await prisma.taskItem.deleteMany({ where: { id: String(req.params.itemId), taskId: task.id, role, ...(role === 'PROOF' ? { submissionId: null } : {}) } });
  if (gone.count === 0) return res.status(404).json({ error: 'Item not found.' });
  res.status(204).end();
});

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
  res.setHeader('Cache-Control', 'private, max-age=3600');
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

tasksRouter.post('/:id/submit', async (req, res) => {
  const task = await load(req, res);
  if (!task) return;
  if (task.assigneeId !== req.user!.id) return res.status(403).json({ error: 'Only the person the task is for can hand in proof.' });
  if (task.status !== 'PENDING' && task.status !== 'REJECTED') return res.status(409).json({ error: 'This task is not waiting for proof.' });
  const parsed = z.object({ note: z.string().trim().max(1000, 'Keep the note under 1000 characters.').optional().default('') }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the note.' });
  const draft = await prisma.taskItem.findMany({ where: { taskId: task.id, role: 'PROOF', submissionId: null }, select: { id: true } });
  if (draft.length === 0) return res.status(400).json({ error: 'Add some proof first: text, a link or a file.' });
  const attempts = await prisma.taskSubmission.count({ where: { taskId: task.id } });
  await prisma.$transaction([
    prisma.taskSubmission.create({
      data: { taskId: task.id, attempt: attempts + 1, note: parsed.data.note || null, items: { connect: draft.map((i) => ({ id: i.id })) } },
    }),
    prisma.task.update({ where: { id: task.id }, data: { status: 'SUBMITTED', completedAt: null } }),
  ]);
  await notifyManagers({ type: 'task_submitted', title: `${req.user!.name} handed in proof`, body: task.title, link: `/tasks/${task.id}` }, req.user!.id);
  const fresh = await prisma.task.findUniqueOrThrow({ where: { id: task.id }, include: PEOPLE });
  res.json({ task: await fullDto(fresh) });
});

tasksRouter.post('/:id/review', async (req, res) => {
  if (!requireManagerHere(req, res)) return;
  const task = await load(req, res);
  if (!task) return;
  if (task.assigneeId === req.user!.id) return res.status(403).json({ error: 'Someone else has to review your own task.' });
  if (task.status !== 'SUBMITTED') return res.status(409).json({ error: 'There is no proof waiting for a decision.' });
  const parsed = z
    .object({ decision: z.enum(['approve', 'reject']), note: z.string().trim().max(1000, 'Keep the note under 1000 characters.').optional().default('') })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the decision.' });
  const { decision, note } = parsed.data;
  if (decision === 'reject' && !note) return res.status(400).json({ error: 'Tell them what is missing, so they know what to add.' });
  const latest = await prisma.taskSubmission.findFirst({ where: { taskId: task.id }, orderBy: { attempt: 'desc' } });
  if (!latest) return res.status(409).json({ error: 'There is no proof waiting for a decision.' });
  const approved = decision === 'approve';
  await prisma.$transaction([
    prisma.taskSubmission.update({
      where: { id: latest.id },
      data: { decision: approved ? 'APPROVED' : 'REJECTED', reviewNote: note || null, reviewedById: req.user!.id, reviewedAt: new Date() },
    }),
    prisma.task.update({ where: { id: task.id }, data: { status: approved ? 'APPROVED' : 'REJECTED', completedAt: approved ? new Date() : null } }),
  ]);
  await notify([task.assigneeId], {
    type: approved ? 'task_approved' : 'task_rejected',
    title: approved ? 'Your task was approved' : 'Your task needs more proof',
    body: approved ? task.title : `${task.title}: ${note}`,
    link: `/tasks/${task.id}`,
  });
  const fresh = await prisma.task.findUniqueOrThrow({ where: { id: task.id }, include: PEOPLE });
  res.json({ task: await fullDto(fresh) });
});
