import { env } from './env.js';

export interface Mail {
  to: string[];
  subject: string;
  // Plain paragraphs; the HTML version is built from the same content and every value is escaped
  paragraphs: string[];
  button?: { label: string; url: string };
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Demo accounts use placeholder addresses that must never be emailed */
export function isDeliverable(email: string) {
  return Boolean(email) && !email.endsWith('.invalid');
}

function toText(mail: Mail) {
  return [...mail.paragraphs, ...(mail.button ? [`${mail.button.label}: ${mail.button.url}`] : []), '— Hackcrew'].join(
    '\n\n'
  );
}

function toHtml(mail: Mail) {
  const paragraphs = mail.paragraphs
    .map((p) => `<p style="margin:0 0 14px;line-height:1.5">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const button = mail.button
    ? `<p style="margin:20px 0"><a href="${escapeHtml(mail.button.url)}" style="background:#2b44c9;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(mail.button.label)}</a></p>`
    : '';
  return `<div style="font-family:system-ui,sans-serif;color:#18213a;max-width:560px">${paragraphs}${button}<p style="color:#7c8598;font-size:13px">Hackcrew</p></div>`;
}

/** "Hackcrew <team@example.com>" as a name and an address */
export function parseSender(from: string) {
  const match = /^\s*(.*?)\s*<([^<>\s]+@[^<>\s]+)>\s*$/.exec(from);
  return match
    ? { name: match[1].replace(/^"|"$/g, '') || 'Hackcrew', email: match[2] }
    : { name: 'Hackcrew', email: from.trim() };
}

/** Sends one copy to one recipient through the configured service; returns an error message or null */
async function deliver(to: string, mail: Mail): Promise<string | null> {
  const text = toText(mail);
  const html = toHtml(mail);
  const res =
    env.emailTransport === 'brevo'
      ? await fetch(`${env.brevoApiUrl}/smtp/email`, {
          method: 'POST',
          headers: { 'api-key': env.brevoApiKey!, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            sender: parseSender(env.emailFrom),
            to: [{ email: to }],
            subject: mail.subject,
            textContent: text,
            htmlContent: html,
          }),
        })
      : await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: env.emailFrom, to: [to], subject: mail.subject, text, html }),
        });
  return res.ok ? null : `${env.emailTransport === 'brevo' ? 'Brevo' : 'Resend'} answered ${res.status} ${await res.text()}`;
}

/**
 * Sends an email. Each recipient gets their own copy, so nobody sees the others' addresses. Never throws:
 * failures are logged and reported as false so callers can carry on. True if at least one copy was sent
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  const to = [...new Set(mail.to.filter(isDeliverable))];
  if (to.length === 0) return false;

  if (env.emailTransport === 'log') {
    console.log(`[mail] to=${to.join(',')} subject=${JSON.stringify(mail.subject)}\n${toText(mail)}\n[/mail]`);
    return true;
  }

  const results = await Promise.all(
    to.map((address) =>
      deliver(address, mail).catch((err: unknown) => (err instanceof Error ? err.message : String(err)))
    )
  );
  const failed = results.filter((r): r is string => r !== null);
  if (failed.length > 0) console.error(`Email "${mail.subject}" was not sent to ${failed.length} of ${to.length}: ${failed[0]}`);
  return failed.length < to.length;
}
