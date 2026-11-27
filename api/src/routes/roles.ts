import { Router } from 'express';
import { requireAuth, requireManager } from '../auth';
import { prisma } from '../db';
import { SYSTEM_ROLES, roleKey } from '../roles';

export const rolesRouter = Router();
rolesRouter.use(requireAuth, requireManager);

/** The built-in roles first, then every other role that has been added so far. */
rolesRouter.get('/', async (_req, res) => {
  const builtIn = new Set(SYSTEM_ROLES.map(roleKey));
  const saved = await prisma.role.findMany({ orderBy: { name: 'asc' } });
  res.json({ roles: [...SYSTEM_ROLES, ...saved.map((r) => r.name).filter((n) => !builtIn.has(roleKey(n)))] });
});
