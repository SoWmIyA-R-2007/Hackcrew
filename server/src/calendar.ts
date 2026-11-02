import type { HackathonDoc } from './models.js';
import { env } from './env.js';

// Builds iCalendar (.ics) files so deadlines can be added to Google Calendar, Outlook or Apple Calendar.

const KEY_DATES = [
  ['registrationDeadline', 'Registration closes'],
  ['kickoffDate', 'Kickoff'],
  ['submissionDeadline', 'Submission deadline'],
  ['shortlistDate', 'Shortlist announced'],
  ['finalPresentationDate', 'Final presentation'],
] as const;

/** Text escaping required by RFC 5545 */
function escapeText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function stamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Lines longer than 75 octets must be folded */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

export function hackathonEvents(h: HackathonDoc) {
  return KEY_DATES.flatMap(([field, label]) => {
    const value = h[field];
    if (!value) return [];
    return [{ uid: `${h._id.toHexString()}-${field}@hacktrack`, start: new Date(value), title: `${label}: ${h.title}`, hackathon: h }];
  });
}

export function buildCalendar(name: string, hackathons: HackathonDoc[]) {
  const now = stamp(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HackTrack//Deadlines//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
  ];
  for (const h of hackathons) {
    for (const e of hackathonEvents(h)) {
      const end = new Date(e.start.getTime() + 60 * 60 * 1000);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${e.uid}`,
        `DTSTAMP:${now}`,
        `DTSTART:${stamp(e.start)}`,
        `DTEND:${stamp(end)}`,
        `SUMMARY:${escapeText(e.title)}`,
        `DESCRIPTION:${escapeText(`Team ${h.teamName}. ${env.appUrl}/dashboard/hackathons/${h._id.toHexString()}`)}`,
        ...(h.websiteLink ? [`URL:${h.websiteLink.replace(/[\r\n]/g, "")}`] : []),
        'END:VEVENT'
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
