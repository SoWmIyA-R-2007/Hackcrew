import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../env.js';
import { sendDueReminders } from '../reminders.js';

// For hosts that put the server to sleep: a scheduled job can call this to send due reminders
export const cronRouter = Router();

function authorized(header: string | undefined) {
  if (!env.cronSecret || !header?.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(env.cronSecret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

cronRouter.post('/reminders', async (req, res) => {
  if (!authorized(req.headers.authorization)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json(await sendDueReminders());
});
