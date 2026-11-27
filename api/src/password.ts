import { randomInt } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';

/** Same rule the admin form shows: at least 10 characters, with a letter and a number. */
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(128, 'Password is too long.')
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Password needs a letter and a number.');

export const hashPassword = (password: string) => hash(password);

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Verified against when no account matches, so a wrong email takes as long as a wrong password.
let dummyHash: Promise<string> | undefined;
export async function burnVerify(password: string): Promise<void> {
  dummyHash ??= hashPassword('dummy-password-for-timing-1');
  await verifyPassword(await dummyHash, password);
}

/** 14 characters from an unambiguous alphabet with a lowercase, uppercase, digit and symbol. */
export function generatePassword(): string {
  const sets = ['abcdefghijkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%&*?'];
  const all = sets.join('');
  const pick = (chars: string) => chars[randomInt(chars.length)];
  const out = sets.map(pick);
  while (out.length < 14) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join('');
}
