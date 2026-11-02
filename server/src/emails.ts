import type { HackathonDoc } from './models.js';
import type { Mail } from './mailer.js';
import { env } from './env.js';

// Every email the app sends. Values from users (titles, names, notes) are escaped by the mailer.

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
    : 'no deadline set';

const hackathonUrl = (h: Pick<HackathonDoc, '_id'>) => `${env.appUrl}/dashboard/hackathons/${h._id.toHexString()}`;

export function verificationEmail(to: string, name: string, token: string): Mail {
  return {
    to: [to],
    subject: 'Confirm your email for HackTrack',
    paragraphs: [
      `Hi ${name},`,
      'Confirm this is your email address so you can reset your password if you ever forget it. The link works for 2 days.',
      "If you didn't create a HackTrack account, you can ignore this email.",
    ],
    button: { label: 'Confirm my email', url: `${env.appUrl}/verify-email?token=${encodeURIComponent(token)}` },
  };
}

export function passwordResetEmail(to: string, name: string, token: string): Mail {
  return {
    to: [to],
    subject: 'Reset your HackTrack password',
    paragraphs: [
      `Hi ${name},`,
      'Someone asked to reset the password for this HackTrack account. The link works for 1 hour and can be used once.',
      "If it wasn't you, ignore this email and your password stays the same.",
    ],
    button: { label: 'Choose a new password', url: `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}` },
  };
}

export function inviteEmail(to: string, inviterName: string, h: HackathonDoc, token: string): Mail {
  return {
    to: [to],
    subject: `${inviterName} invited you to ${h.title} on HackTrack`,
    paragraphs: [
      `${inviterName} added you to team ${h.teamName} for ${h.title} and invited you to track it together on HackTrack.`,
      `Submission deadline: ${when(h.submissionDeadline)}.`,
      'Accept the invite to see the problem statement, tasks and deadlines, and to get reminders. The link works for 14 days.',
    ],
    button: { label: 'Accept the invite', url: `${env.appUrl}/invite/${encodeURIComponent(token)}` },
  };
}

function statusLines(h: HackathonDoc) {
  const open = h.tasks.filter((t) => !t.completed);
  const missing = [
    ['repository', h.submission?.repoUrl],
    ['demo video', h.submission?.demoVideoUrl],
    ['pitch deck', h.submission?.deckUrl],
    ['project page', h.submission?.projectUrl],
  ]
    .filter(([, v]) => !v)
    .map(([label]) => label);
  return [
    `Progress: ${h.completion}% of tasks done, ${open.length} open.`,
    ...(open.length ? [`Open tasks:\n${open.slice(0, 10).map((t) => `• ${t.title} (${t.assigneeName || 'unassigned'})`).join('\n')}`] : []),
    missing.length ? `Still missing for the submission: ${missing.join(', ')}.` : 'All submission links are added.',
  ];
}

export function reminderEmail(to: string[], h: HackathonDoc, daysBefore: number): Mail {
  const span = daysBefore === 1 ? '1 day' : `${daysBefore} days`;
  return {
    to,
    subject: `${h.title}: submission due in ${span}`,
    paragraphs: [`The submission deadline for ${h.title} is ${when(h.submissionDeadline)}, ${span} from now.`, ...statusLines(h)],
    button: { label: 'Open the hackathon', url: hackathonUrl(h) },
  };
}

export function teamUpdateEmail(to: string[], senderName: string, h: HackathonDoc, note: string): Mail {
  return {
    to,
    subject: `${h.title}: status update from ${senderName}`,
    paragraphs: [
      `${senderName} sent the team a status update for ${h.title}.`,
      ...(note ? [`Their note:\n${note}`] : []),
      `Submission deadline: ${when(h.submissionDeadline)}.`,
      ...statusLines(h),
    ],
    button: { label: 'Open the hackathon', url: hackathonUrl(h) },
  };
}
