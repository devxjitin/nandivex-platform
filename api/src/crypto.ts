import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from './config';

/* AES-256-GCM for the few fields that must not sit in the database as plain text (PAN, bank account number).
   The stored value is base64 of: 12-byte nonce, 16-byte auth tag, ciphertext. The key lives only in the
   server environment (DATA_ENCRYPTION_KEY); lose it and these fields cannot be read back. */

const key = () => Buffer.from(config.DATA_ENCRYPTION_KEY, 'hex');

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

export function decryptField(stored: string): string {
  const raw = Buffer.from(stored, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

export const last4 = (value: string) => value.slice(-4);
