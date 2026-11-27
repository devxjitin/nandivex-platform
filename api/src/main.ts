import { createApp } from './app';
import { config } from './config';
import { prisma } from './db';

const server = createApp().listen(config.PORT, () => {
  console.log(`NandiVex API listening on :${config.PORT} (${config.NODE_ENV})`);
});

const shutdown = () => {
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
