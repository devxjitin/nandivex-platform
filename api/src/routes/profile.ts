import express, { Router } from 'express';
import type { Profile, User } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, toDto } from '../auth';
import { encryptField, last4 } from '../crypto';
import { prisma } from '../db';

export const profileRouter = Router();
profileRouter.use(requireAuth);

const ADDRESS_KEYS = ['line1', 'line2', 'city', 'state', 'pincode', 'country'] as const;
type Address = Record<(typeof ADDRESS_KEYS)[number], string>;
const emptyAddress = (): Address => ({ line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' });

function addressFrom(json: unknown): Address {
  const out = emptyAddress();
  if (json && typeof json === 'object') {
    for (const k of ADDRESS_KEYS) {
      const v = (json as Record<string, unknown>)[k];
      if (typeof v === 'string') out[k] = v;
    }
  }
  return out;
}

/** What the web app gets. The full PAN and account number are never sent back, only the last four characters. */
export function profileDto(user: User, p: Profile | null) {
  return {
    fullName: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    photoVersion: user.photoUpdatedAt ? user.photoUpdatedAt.getTime() : null,
    dateOfBirth: p?.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : '',
    gender: p?.gender ?? '',
    bloodGroup: p?.bloodGroup ?? '',
    phone: p?.phone ?? '',
    emergencyName: p?.emergencyName ?? '',
    emergencyRelation: p?.emergencyRelation ?? '',
    emergencyPhone: p?.emergencyPhone ?? '',
    currentAddress: addressFrom(p?.currentAddress),
    permanentAddress: addressFrom(p?.permanentAddress),
    pan: { saved: !!p?.panEnc, last4: p?.panLast4 ?? '' },
    bank: {
      holder: p?.bankHolder ?? '',
      name: p?.bankName ?? '',
      ifsc: p?.bankIfsc ?? '',
      branch: p?.bankBranch ?? '',
      accountSaved: !!p?.bankAccountEnc,
      accountLast4: p?.bankAccountLast4 ?? '',
    },
  };
}

profileRouter.get('/', async (req, res) => {
  const p = await prisma.profile.findUnique({ where: { userId: req.user!.id } });
  res.json({ profile: profileDto(req.user!, p) });
});

// --- Update ----------------------------------------------------------------------------------

/** Trimmed text, empty becomes null. */
const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`).transform((v) => v || null);
/** Text that must match a pattern when it is filled in. */
const pattern = (re: RegExp, message: string, max = 60) =>
  z.string().trim().max(max).refine((v) => v === '' || re.test(v), message).transform((v) => v || null);
const phone = pattern(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a 10-digit mobile number.', 20);

const address = z
  .object({
    line1: text(120),
    line2: text(120),
    city: text(60),
    state: text(60),
    pincode: pattern(/^\d{6}$/, 'Pincode must be 6 digits.', 10),
    country: text(60),
  })
  .transform((a): Address => ({
    line1: a.line1 ?? '',
    line2: a.line2 ?? '',
    city: a.city ?? '',
    state: a.state ?? '',
    pincode: a.pincode ?? '',
    country: a.country ?? '',
  }));

const dateOfBirth = z
  .string()
  .trim()
  .refine((v) => {
    if (v === '') return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.getUTCFullYear() >= 1900 && d.getTime() <= Date.now();
  }, 'Enter a valid date of birth.')
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const oneOf = (list: string[], message: string) =>
  z.string().trim().refine((v) => v === '' || list.includes(v), message).transform((v) => v || null);

const updateBody = z.object({
  dateOfBirth,
  gender: oneOf(GENDERS, 'Choose a gender from the list.'),
  bloodGroup: oneOf(BLOOD_GROUPS, 'Choose a blood group from the list.'),
  phone,
  emergencyName: text(80),
  emergencyRelation: text(40),
  emergencyPhone: phone,
  currentAddress: address,
  permanentAddress: address,
  // Only sent when the person types a new value; empty keeps what is saved.
  pan: z.string().trim().toUpperCase().refine((v) => v === '' || /^[A-Z]{5}\d{4}[A-Z]$/.test(v), 'PAN looks like ABCDE1234F.').optional(),
  bankHolder: text(80),
  bankName: text(80),
  bankIfsc: z.string().trim().toUpperCase().refine((v) => v === '' || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), 'IFSC looks like HDFC0001234.').transform((v) => v || null),
  bankBranch: text(80),
  bankAccountNumber: z.string().trim().refine((v) => v === '' || /^\d{9,18}$/.test(v), 'Account number is 9 to 18 digits.').optional(),
});

profileRouter.put('/', async (req, res) => {
  const parsed = updateBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Check the details and try again.' });
  }
  const b = parsed.data;
  const data = {
    dateOfBirth: b.dateOfBirth,
    gender: b.gender,
    bloodGroup: b.bloodGroup,
    phone: b.phone,
    emergencyName: b.emergencyName,
    emergencyRelation: b.emergencyRelation,
    emergencyPhone: b.emergencyPhone,
    currentAddress: b.currentAddress,
    permanentAddress: b.permanentAddress,
    bankHolder: b.bankHolder,
    bankName: b.bankName,
    bankIfsc: b.bankIfsc,
    bankBranch: b.bankBranch,
    ...(b.pan ? { panEnc: encryptField(b.pan), panLast4: last4(b.pan) } : {}),
    ...(b.bankAccountNumber ? { bankAccountEnc: encryptField(b.bankAccountNumber), bankAccountLast4: last4(b.bankAccountNumber) } : {}),
  };
  const saved = await prisma.profile.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id, ...data },
    update: data,
  });
  return res.json({ profile: profileDto(req.user!, saved) });
});

// --- Photo -----------------------------------------------------------------------------------

const MAX_PHOTO_BYTES = 400 * 1024;

function imageType(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

profileRouter.put('/photo', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_PHOTO_BYTES }), async (req, res) => {
  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: 'Choose a JPG, PNG or WebP picture.' });
  // The first bytes must really be an image, whatever the header says.
  const type = imageType(body);
  if (!type) return res.status(400).json({ error: 'That file is not a JPG, PNG or WebP picture.' });
  const me = req.user!;
  const bytes = new Uint8Array(body);
  await prisma.profilePhoto.upsert({
    where: { userId: me.id },
    create: { userId: me.id, contentType: type, data: bytes },
    update: { contentType: type, data: bytes },
  });
  const updated = await prisma.user.update({ where: { id: me.id }, data: { photoUpdatedAt: new Date() } });
  return res.json({ user: toDto(updated) });
});

profileRouter.get('/photo', async (req, res) => {
  const photo = await prisma.profilePhoto.findUnique({ where: { userId: req.user!.id } });
  if (!photo) return res.status(404).json({ error: 'No picture yet.' });
  res.setHeader('Content-Type', photo.contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.send(Buffer.from(photo.data));
});

profileRouter.delete('/photo', async (req, res) => {
  const me = req.user!;
  await prisma.profilePhoto.deleteMany({ where: { userId: me.id } });
  const updated = await prisma.user.update({ where: { id: me.id }, data: { photoUpdatedAt: null } });
  return res.json({ user: toDto(updated) });
});
