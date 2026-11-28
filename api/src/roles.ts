import { z } from 'zod';

/* Roles are free text, created by admins as they add people (see the Role table).
   Only these names carry extra rights. Keep in step with src/data/roles.js in the web app. */
const MANAGER_KEYS = ['founder', 'co-founder', 'admin'];

export const roleKey = (role: string) => role.trim().toLowerCase();

/** Roles that may add, reset and remove employees. */
export const isManagerRole = (role: string) => MANAGER_KEYS.includes(roleKey(role));

/** Admins run the platform; tasks are never given to them. */
export const isAdminRole = (role: string) => roleKey(role) === 'admin';

/** Built-in roles. They are always in the role list, whether or not anyone has them yet. */
export const SYSTEM_ROLES = ['Founder', 'Co-Founder', 'Admin'];

/** The same names, used for the "at least one admin must remain" check. */
export const MANAGER_ROLE_NAMES = SYSTEM_ROLES;

/** Gives a typed role its proper spelling when it is a built-in one ("founder" becomes "Founder"). */
export const canonicalRole = (role: string) => SYSTEM_ROLES.find((r) => roleKey(r) === roleKey(role)) ?? role;

/** A role name as typed by an admin: trimmed, single spaces, 2 to 40 characters of letters, digits and & / . - + ( ). */
export const roleNameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(2, 'Role name must be at least 2 characters.')
      .max(40, 'Role name is too long.')
      .regex(/^[\p{L}\p{N} &/.+()-]+$/u, 'Role name has characters that are not allowed.'),
  );
