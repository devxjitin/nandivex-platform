import { prisma } from './db';
import { MANAGER_ROLE_NAMES } from './roles';

interface Message {
  type: string;
  title: string;
  body?: string;
  /** A page in the web app, e.g. /admin/employees/<id>. */
  link?: string;
}

/** Saves a notification for each person. Never throws: a failed notification must not fail the action itself. */
export async function notify(userIds: string[], message: Message): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await prisma.notification.createMany({ data: userIds.map((userId) => ({ userId, ...message })) });
  } catch (err) {
    console.error('notify failed', err);
  }
}

/** Tells every Founder, Co-Founder and Admin, except the people listed (the one who did it, the one it is about). */
export async function notifyManagers(message: Message, ...except: string[]): Promise<void> {
  try {
    const managers = await prisma.user.findMany({
      where: {
        AND: [
          { OR: MANAGER_ROLE_NAMES.map((r) => ({ role: { equals: r, mode: 'insensitive' as const } })) },
          ...(except.length > 0 ? [{ id: { notIn: except } }] : []),
        ],
      },
      select: { id: true },
    });
    await notify(managers.map((m) => m.id), message);
  } catch (err) {
    console.error('notifyManagers failed', err);
  }
}
