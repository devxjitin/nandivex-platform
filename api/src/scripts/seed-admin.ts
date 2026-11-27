/* Creates the first admin from SEED_ADMIN_* when there are no users yet. Safe to run on every start. */
import { config } from '../config';
import { prisma } from '../db';
import { hashPassword, passwordSchema } from '../password';

async function main() {
  const { SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = config;
  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    console.log('seed-admin: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set, skipping.');
    return;
  }
  if ((await prisma.user.count()) > 0) {
    console.log('seed-admin: users already exist, skipping.');
    return;
  }
  const password = passwordSchema.parse(SEED_ADMIN_PASSWORD);
  await prisma.role.upsert({ where: { nameKey: 'admin' }, update: {}, create: { name: 'Admin', nameKey: 'admin' } });
  await prisma.user.create({
    data: {
      name: SEED_ADMIN_NAME || 'Admin',
      email: SEED_ADMIN_EMAIL.toLowerCase(),
      role: 'Admin',
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
      status: 'ACTIVE',
    },
  });
  console.log(`seed-admin: created admin ${SEED_ADMIN_EMAIL}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
