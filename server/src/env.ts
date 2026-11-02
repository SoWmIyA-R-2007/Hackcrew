import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// Environment lives in the repo root (.env.local first, then .env), shared with nothing else
const root = fileURLToPath(new URL('../../', import.meta.url));
config({ path: [`${root}.env.local`, `${root}.env`], quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Which service sends email: EMAIL_TRANSPORT when set to log, brevo or resend; otherwise whichever API key
 * is present (Brevo first). With no usable key, emails are printed to the server log instead
 */
function emailTransport(): 'log' | 'brevo' | 'resend' {
  const chosen = process.env.EMAIL_TRANSPORT;
  if (chosen === 'log') return 'log';
  if (chosen === 'brevo') return process.env.BREVO_API_KEY ? 'brevo' : 'log';
  if (chosen === 'resend') return process.env.RESEND_API_KEY ? 'resend' : 'log';
  if (process.env.BREVO_API_KEY) return 'brevo';
  if (process.env.RESEND_API_KEY) return 'resend';
  return 'log';
}

export const env = {
  // Hosts set PORT in production; in development the API keeps its own port so it never collides with Vite
  port: Number(isProduction ? process.env.PORT : process.env.API_PORT) || 4000,
  isProduction,
  // Public URL of the app (the Vite dev server in development); used for the Google redirect URI
  appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  mongoUri: process.env.MONGODB_URI,
  mongoDb: process.env.MONGODB_DB || 'hacktrack',
  sessionSecret: process.env.SESSION_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  // Email: sent through Brevo or Resend when its API key is set, otherwise printed to the server log
  resendApiKey: process.env.RESEND_API_KEY,
  brevoApiKey: process.env.BREVO_API_KEY,
  brevoApiUrl: (process.env.BREVO_API_URL || 'https://api.brevo.com/v3').replace(/\/$/, ''),
  // "Name <address>". With Brevo the address must be a sender verified in your Brevo account
  emailFrom: process.env.EMAIL_FROM || 'Hackcrew <onboarding@resend.dev>',
  emailTransport: emailTransport(),
  // Protects POST /api/cron/reminders for hosts that run scheduled jobs
  cronSecret: process.env.CRON_SECRET,
  // GitHub API for project repositories. A token is optional: it raises the limit from 60 to 5,000 requests an hour
  githubApiUrl: (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, ''),
  githubToken: process.env.GITHUB_TOKEN,
  // How often the server itself checks for reminder emails to send; 0 turns the built-in check off
  reminderIntervalMinutes: Number(process.env.REMINDER_INTERVAL_MINUTES ?? 15),
};
