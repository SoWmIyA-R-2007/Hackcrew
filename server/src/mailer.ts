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
  return [...mail.paragraphs, ...(mail.button ? [`${mail.button.label}: ${mail.button.url}`] : []), '— HackTrack'].join(
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
  return `<div style="font-family:system-ui,sans-serif;color:#18213a;max-width:560px">${paragraphs}${button}<p style="color:#7c8598;font-size:13px">HackTrack</p></div>`;
}

/** Sends an email. Never throws: failures are logged and reported as false so callers can carry on */
export async function sendMail(mail: Mail): Promise<boolean> {
  const to = [...new Set(mail.to.filter(isDeliverable))];
  if (to.length === 0) return false;

  if (env.emailTransport === 'log') {
    console.log(`[mail] to=${to.join(',')} subject=${JSON.stringify(mail.subject)}\n${toText(mail)}\n[/mail]`);
    return true;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.emailFrom, to, subject: mail.subject, text: toText(mail), html: toHtml(mail) }),
    });
    if (!res.ok) {
      console.error(`Email "${mail.subject}" was not sent: Resend answered ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Email "${mail.subject}" was not sent:`, err instanceof Error ? err.message : err);
    return false;
  }
}
