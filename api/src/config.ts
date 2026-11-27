import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  // 32-byte key as 64 hex characters. Encrypts PAN and bank account numbers. Generate with: openssl rand -hex 32
  DATA_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'DATA_ENCRYPTION_KEY must be 64 hex characters'),
  // Where the web app lives. Used for CORS and for the sign-in link inside emails.
  WEB_URL: z.string().url().default('http://localhost:5180'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  MAIL_FROM: z.string().default('NandiVex <support@nandivex.com>'),
  // Optional first admin, created only while there are no users yet.
  SEED_ADMIN_NAME: z.string().optional(),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

export const config = schema.parse(process.env);
export const isProd = config.NODE_ENV === 'production';
