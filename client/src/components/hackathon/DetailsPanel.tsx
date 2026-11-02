import React, { useState } from 'react';
import { CalendarPlus, Download, ExternalLink } from 'lucide-react';
import { HackathonView } from '@/lib/types';
import { api } from '@/lib/api';
import { PRIORITY_LABEL, formatDate } from '@/lib/utils';

const MODE_LABEL: Record<string, string> = { online: 'Online', offline: 'In person', hybrid: 'Hybrid' };

const KEY_DATES = [
  { field: 'registrationDeadline', label: 'Registration closes' },
  { field: 'kickoffDate', label: 'Kickoff' },
  { field: 'submissionDeadline', label: 'Submission deadline' },
  { field: 'shortlistDate', label: 'Shortlist announced' },
  { field: 'finalPresentationDate', label: 'Final presentation' },
] as const;

/** Link that opens Google Calendar with a one-hour event already filled in */
function googleCalendarUrl(title: string, iso: string, details: string) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(iso);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${stamp(start)}/${stamp(end)}`, details });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export const DetailsPanel: React.FC<{ hackathon: HackathonView }> = ({ hackathon }) => {
  // Captured once per mount so renders stay pure
  const [now] = useState(() => Date.now());
  const dates = KEY_DATES.flatMap(({ field, label }) => {
    const value = hackathon[field];
    return value ? [{ field, label, value }] : [];
  });

  return (
    <section aria-labelledby="details-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
      <h2 id="details-heading" className="font-display text-lg font-semibold">
        Dates and details
      </h2>

      <ul className="mt-3 text-sm divide-y divide-rule">
        {dates.map(({ field, label, value }) => {
          const past = new Date(value).getTime() < now;
          return (
            <li key={field} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className={past ? 'text-ink-3' : 'text-ink'}>{label}</p>
                <p className={`tabular-nums ${past ? 'text-ink-3' : 'text-ink-2'}`}>{formatDate(value)}</p>
              </div>
              {!past && (
                <a
                  href={googleCalendarUrl(
                    `${label}: ${hackathon.title}`,
                    value,
                    `Team ${hackathon.teamName}. ${window.location.origin}/dashboard/hackathons/${hackathon.id}`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="icon-btn shrink-0"
                  title="Add to Google Calendar"
                  aria-label={`Add ${label.toLowerCase()} to Google Calendar`}
                >
                  <CalendarPlus className="w-4 h-4" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
      <a href={api.calendarUrl(hackathon.id)} className="btn btn-ghost text-sm mt-1 -ml-2">
        <Download className="w-4 h-4" />
        Download all dates (.ics)
      </a>

      <dl className="mt-3 pt-3 border-t border-rule text-sm divide-y divide-rule">
        {[
          ['Format', MODE_LABEL[hackathon.mode ?? 'online']],
          ['Priority', PRIORITY_LABEL[hackathon.priority]],
          ['Reference', hackathon.code],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2.5">
            <dt className="text-ink-3">{label}</dt>
            <dd className="text-ink text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {hackathon.websiteLink && (
        <a href={hackathon.websiteLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full mt-3">
          Open event website
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </section>
  );
};
