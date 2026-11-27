import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { prisma } from './db';
import { authRouter } from './routes/auth';
import { employeesRouter } from './routes/employees';
import { notificationsRouter } from './routes/notifications';
import { profileRouter } from './routes/profile';
import { rolesRouter } from './routes/roles';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.WEB_URL.replace(/\/$/, ''), credentials: true }));
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());

  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.use('/auth', authRouter);
  app.use('/employees', employeesRouter);
  app.use('/profile', profileRouter);
  app.use('/notifications', notificationsRouter);
  app.use('/roles', rolesRouter);

  app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (err as { status?: number })?.status;
    if (status === 413) return res.status(413).json({ error: 'That file is too large.' });
    if (status === 400) return res.status(400).json({ error: 'Could not read that request.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  return app;
}
