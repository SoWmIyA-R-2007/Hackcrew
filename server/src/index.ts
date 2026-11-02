import './env.js';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';
import { describeMongoUri, getDb, isDbUnreachable } from './db.js';
import { authRouter } from './routes/auth.js';
import { hackathonsRouter } from './routes/hackathons.js';
import { invitesRouter } from './routes/invites.js';
import { notificationsRouter } from './routes/notifications.js';
import { cronRouter } from './routes/cron.js';
import { profileRouter } from './routes/profile.js';
import { friendsRouter } from './routes/friends.js';
import { projectsRouter } from './routes/projects.js';
import { startReminderTimer } from './reminders.js';
import { backfillUsernames } from './usernames.js';

const app = express();
app.disable('x-powered-by');
// Hosting platforms put a proxy in front of the app; trust it so req.ip is the visitor's address
if (env.isProduction) app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/hackathons', hackathonsRouter);
app.use('/api/invites', invitesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/cron', cronRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// In production the built React app is served from the same origin as the API
const clientDist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
if (env.isProduction && existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // Any other path is a client-side route
  app.get('/{*path}', (_req, res) => {
    res.sendFile('index.html', { root: clientDist });
  });
}

// Express 5 forwards errors thrown in async handlers here
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (isDbUnreachable(err)) {
    console.error(`Cannot reach MongoDB at ${describeMongoUri()}. Start it with "npm run db" or fix MONGODB_URI.`);
    res.status(503).json({
      error: 'The app cannot reach its database right now. If you are running it locally, start MongoDB and try again.',
    });
    return;
  }
  // Body parser errors: too large, or not valid JSON
  const type = (err as { type?: string })?.type;
  if (type === 'entity.too.large') {
    res.status(413).json({ error: 'That is too much data to send at once. Shorten it and try again.' });
    return;
  }
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: 'The request could not be read. Reload the page and try again.' });
    return;
  }
  console.error(err);
  const message =
    err instanceof Error && /MONGODB_URI|SESSION_SECRET/.test(err.message)
      ? err.message
      : 'Something went wrong on the server. Check the server logs for details.';
  const status = (err as { status?: number })?.status ?? 500;
  res.status(status >= 400 && status < 500 ? status : 500).json({
    error: status >= 400 && status < 500 ? 'Invalid request.' : message,
  });
});

app.listen(env.port, () => {
  console.log(`HackTrack API listening on http://localhost:${env.port}`);
  // Check the database up front so a missing MongoDB is obvious before anyone tries to sign in
  getDb()
    .then(() => {
      console.log(`Connected to MongoDB at ${describeMongoUri()}`);
      console.log(
        env.emailTransport === 'log'
          ? 'Emails are printed here instead of sent (set RESEND_API_KEY to send them).'
          : `Emails are sent through Resend from ${env.emailFrom}.`
      );
      startReminderTimer(env.reminderIntervalMinutes);
      backfillUsernames()
        .then((count) => count && console.log(`Gave ${count} existing ${count === 1 ? 'account' : 'accounts'} a username.`))
        .catch((err) => console.error('Could not add usernames:', err instanceof Error ? err.message : err));
    })
    .catch((err) => {
      if (isDbUnreachable(err)) {
        console.error(
          `Cannot reach MongoDB at ${describeMongoUri()}. Start it with "npm run db" (local) or fix MONGODB_URI in .env.local.`
        );
      } else {
        console.error(err instanceof Error ? err.message : err);
      }
    });
});
