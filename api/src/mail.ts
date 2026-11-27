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
  const loginUrl = `${config.WEB_URL.replace(/\/$/, '')}/`;
  const subject = m.reset ? 'Your NandiVex password was reset' : 'Your NandiVex account is ready';
  const lead = m.reset
    ? 'An admin has set a new password for your NandiVex account.'
    : `An account has been created for you at NandiVex Technologies as <b>${esc(m.role)}</b>.`;
  const change = m.mustChangePassword
    ? 'You will be asked to choose your own password the first time you sign in.'
    : 'Keep this password safe and do not share it with anyone.';

  const text = [
    `Hi ${m.name},`,
    '',
    m.reset ? 'An admin has set a new password for your NandiVex account.' : `An account has been created for you at NandiVex Technologies as ${m.role}.`,
    '',
    `Sign in: ${loginUrl}`,
    `Email: ${m.to}`,
    `Password: ${m.password}`,
    '',
    change,
    '',
    'NandiVex Technologies',
  ].join('\n');

  const html = `<!doctype html><html><body style="margin:0;background:#f7f3fd;font-family:Inter,Arial,sans-serif;color:#1b1426">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #e6def2;border-radius:20px">
<tr><td style="padding:32px">
<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7a3ce0">NandiVex Technologies</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25">${esc(subject)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6">Hi ${esc(m.name)},<br>${lead}</p>
<table role="presentation" width="100%" style="background:#f7f3fd;border-radius:14px;margin:0 0 20px"><tr><td style="padding:16px 18px;font-size:14px;line-height:1.9">
<span style="color:#655c75">Email</span><br><b>${esc(m.to)}</b><br>
<span style="color:#655c75">Password</span><br><b style="font-family:Consolas,monospace;font-size:15px">${esc(m.password)}</b>
</td></tr></table>
<p style="margin:0 0 24px"><a href="${esc(loginUrl)}" style="display:inline-block;background:#7a3ce0;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:999px">Sign in</a></p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#655c75">${esc(change)}</p>
</td></tr></table></td></tr></table></body></html>`;

  await transport.sendMail({ from: config.MAIL_FROM, to: m.to, subject, text, html });
}
