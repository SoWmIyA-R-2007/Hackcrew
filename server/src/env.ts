import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// Environment lives in the repo root (.env.local first, then .env), shared with nothing else
const root = fileURLToPath(new URL('../../', import.meta.url));
config({ path: [`${root}.env.local`, `${root}.env`], quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

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
  // Email: sent through Resend when RESEND_API_KEY is set, otherwise printed to the server log
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM || 'HackTrack <onboarding@resend.dev>',
  emailTransport: (process.env.EMAIL_TRANSPORT === 'log' || !process.env.RESEND_API_KEY ? 'log' : 'resend') as
    | 'log'
    | 'resend',
  // Protects POST /api/cron/reminders for hosts that run scheduled jobs
  cronSecret: process.env.CRON_SECRET,
  // GitHub API for project repositories. A token is optional: it raises the limit from 60 to 5,000 requests an hour
  githubApiUrl: (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, ''),
  githubToken: process.env.GITHUB_TOKEN,
  // How often the server itself checks for reminder emails to send; 0 turns the built-in check off
  reminderIntervalMinutes: Number(process.env.REMINDER_INTERVAL_MINUTES ?? 15),
};
