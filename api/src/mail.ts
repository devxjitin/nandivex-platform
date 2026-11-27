import nodemailer from 'nodemailer';
import { config } from './config';

const transport = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_SECURE === 'true',
  auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
});

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const COMPANY = 'NandiVex Technologies';
const HELP_EMAIL = 'contact@nandivex.com';

interface LoginEmail {
  to: string;
  name: string;
  role: string;
  password: string;
  mustChangePassword: boolean;
  /** true when this is a reset rather than a brand new account. */
  reset: boolean;
}

/** Sends the sign-in details. Throws if the mail server rejects it, so the caller can tell the admin. */
export async function sendLoginEmail(m: LoginEmail): Promise<void> {
  const base = config.WEB_URL.replace(/\/$/, '');
  const loginUrl = `${base}/`;
  const logoUrl = `${base}/brand/logo-horizontal.png`;
  const firstName = m.name.trim().split(/\s+/)[0] || m.name;

  const subject = m.reset ? `Your ${COMPANY} password has been reset` : `Welcome to ${COMPANY}: your account details`;
  const heading = m.reset ? 'Your password has been reset' : `Welcome to ${COMPANY}`;
  const intro = m.reset
    ? 'An administrator has set a new password for your account. Use the details below to sign in.'
    : `Your account has been created and you have been added as <strong>${esc(m.role)}</strong>. Use the details below to sign in.`;
  const introText = m.reset
    ? 'An administrator has set a new password for your account. Use the details below to sign in.'
    : `Your account has been created and you have been added as ${m.role}. Use the details below to sign in.`;
  const change = m.mustChangePassword
    ? 'For your security, you will be asked to choose a new password the first time you sign in.'
    : 'Please keep this password private and do not share it with anyone.';
  const preheader = `Sign in at ${base.replace(/^https?:\/\//, '')} with the details in this email.`;

  const text = [
    `Hello ${firstName},`,
    '',
    introText,
    '',
    'SIGN-IN DETAILS',
    `Sign-in page: ${loginUrl}`,
    `Email:        ${m.to}`,
    `Password:     ${m.password}`,
    '',
    change,
    'Nobody at NandiVex will ever ask you for this password. If you were not expecting this email, please let us know.',
    '',
    `Need help? Write to ${HELP_EMAIL}.`,
    '',
    'Regards,',
    COMPANY,
    '',
    '--',
    'This is an automated message.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f1f9;font-family:Inter,'Segoe UI',Arial,Helvetica,sans-serif;color:#1b1426">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f1f9">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1f9"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px"><img src="${esc(logoUrl)}" width="150" alt="${COMPANY}" style="display:block;border:0;height:auto;font-size:15px;font-weight:700;color:#1b1426"></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e6def2;border-radius:16px;overflow:hidden">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="height:4px;background:#7a3ce0;font-size:0;line-height:0">&nbsp;</td></tr>
  <tr><td style="padding:32px 32px 8px">
    <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;font-weight:700;color:#1b1426">${esc(heading)}</h1>
    <p style="margin:0 0 6px;font-size:15px;line-height:1.65">Hello ${esc(firstName)},</p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#3d3450">${intro}</p>
  </td></tr>
  <tr><td style="padding:20px 32px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5fd;border:1px solid #e6def2;border-radius:12px">
      <tr><td style="padding:16px 18px 4px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#7a3ce0">Your sign-in details</td></tr>
      <tr><td style="padding:8px 18px 0;font-size:13px;color:#655c75">Email</td></tr>
      <tr><td style="padding:2px 18px 10px;font-size:15px;font-weight:600;color:#1b1426">${esc(m.to)}</td></tr>
      <tr><td style="padding:0 18px;font-size:13px;color:#655c75">Password</td></tr>
      <tr><td style="padding:2px 18px 18px;font-family:Consolas,'Courier New',monospace;font-size:16px;font-weight:700;letter-spacing:.02em;color:#1b1426">${esc(m.password)}</td></tr>
    </table>
  </td></tr>
  <tr><td align="left" style="padding:24px 32px 8px">
    <a href="${esc(loginUrl)}" style="display:inline-block;background:#7a3ce0;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;line-height:1;padding:14px 28px;border-radius:999px">Sign in to your account</a>
  </td></tr>
  <tr><td style="padding:12px 32px 4px;font-size:12px;line-height:1.6;color:#655c75">Button not working? Copy this link into your browser:<br><a href="${esc(loginUrl)}" style="color:#7a3ce0;text-decoration:underline">${esc(loginUrl)}</a></td></tr>
  <tr><td style="padding:20px 32px 32px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee8f6"><tr><td style="padding-top:18px;font-size:13px;line-height:1.65;color:#3d3450">
      ${esc(change)}<br>
      Nobody at NandiVex will ever ask you for this password. If you were not expecting this email, please let us know.
    </td></tr></table>
  </td></tr>
  </table>
</td></tr>
<tr><td align="center" style="padding:22px 12px 0;font-size:12px;line-height:1.7;color:#8a8199">
  <strong style="color:#655c75">${COMPANY}</strong><br>
  Need help? Write to <a href="mailto:${HELP_EMAIL}" style="color:#7a3ce0;text-decoration:none">${HELP_EMAIL}</a><br>
  This is an automated message.
</td></tr>
</table></td></tr></table></body></html>`;

  await transport.sendMail({
    from: config.MAIL_FROM,
    replyTo: HELP_EMAIL,
    to: m.to,
    subject,
    text,
    html,
    headers: { 'X-Auto-Response-Suppress': 'All' },
  });
}
