import { collections } from './db.js';
import { reminderEmail } from './emails.js';
import { isDeliverable, sendMail } from './mailer.js';
import { DEFAULT_REMINDERS } from './models.js';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Sends the reminder emails that are due. Safe to run often and from several servers at once:
 * each reminder is claimed in the database before it is sent, so it goes out only once.
 */
export async function sendDueReminders(now = new Date()) {
  const { users, hackathons } = await collections();
  const horizon = new Date(now.getTime() + 31 * DAY).toISOString();
  const candidates = await hackathons
    .find({
      status: { $in: ['not_started', 'in_progress'] },
      'reminders.enabled': { $ne: false },
      submissionDeadline: { $gt: now.toISOString(), $lte: horizon },
    })
    .toArray();

  let sent = 0;
  for (const h of candidates) {
    const deadline = h.submissionDeadline!;
    const daysLeft = (new Date(deadline).getTime() - now.getTime()) / DAY;
    const passed = (h.reminders?.daysBefore ?? DEFAULT_REMINDERS.daysBefore).filter((d) => daysLeft <= d);
    if (passed.length === 0) continue;

    // Only the nearest reminder is sent; earlier ones that were missed are marked done with it
    const nearest = Math.min(...passed);
    const key = `${deadline}|${nearest}`;
    const claimed = await hackathons.updateOne(
      { _id: h._id, remindersSent: { $ne: key } },
      { $addToSet: { remindersSent: { $each: passed.map((d) => `${deadline}|${d}`) } } }
    );
    if (claimed.modifiedCount === 0) continue;

    const recipients = await users
      .find({ _id: { $in: [h.ownerId, ...(h.memberIds ?? [])] }, isDemo: { $ne: true } }, { projection: { email: 1 } })
      .toArray();
    const to = recipients.map((u) => u.email).filter(isDeliverable);
    if (to.length && (await sendMail(reminderEmail(to, h, nearest)))) sent++;
  }
  return { checked: candidates.length, sent };
}

/** Runs the reminder check on a timer inside the server process */
export function startReminderTimer(intervalMinutes: number) {
  if (!intervalMinutes || intervalMinutes <= 0) return;
  const run = () =>
    sendDueReminders().catch((err) => console.error('Reminder check failed:', err instanceof Error ? err.message : err));
  setTimeout(run, 10_000);
  setInterval(run, intervalMinutes * 60 * 1000).unref();
}
