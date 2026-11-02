import React, { useState } from 'react';
import { Link } from 'react-router';
import { HackathonView } from '@/lib/types';
import { STATUS_META, formatShortDate, isOverdue } from '@/lib/utils';

interface DeadlineTimelineProps {
  hackathons: HackathonView[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Dates other than kickoff and submission, drawn as small diamonds on the row
const MARKERS = [
  { field: 'registrationDeadline', label: 'Registration closes' },
  { field: 'shortlistDate', label: 'Shortlist announced' },
  { field: 'finalPresentationDate', label: 'Final presentation' },
] as const;

const markerDates = (h: HackathonView) =>
  MARKERS.flatMap(({ field, label }) => (h[field] ? [{ label, time: new Date(h[field] as string).getTime() }] : []));

/**
 * Every hackathon on one calendar: a bar from kickoff to submission deadline,
 * filled to its task progress, with a marker for today.
 */
export const DeadlineTimeline: React.FC<DeadlineTimelineProps> = ({ hackathons }) => {
  // Captured once per mount so renders stay pure
  const [now] = useState(() => Date.now());
  if (hackathons.length === 0) return null;

  const starts = hackathons.map((h) => new Date(h.kickoffDate).getTime());
  const ends = hackathons.map((h) =>
    h.submissionDeadline ? new Date(h.submissionDeadline).getTime() : now
  );
  const markerTimes = hackathons.flatMap((h) => markerDates(h).map((m) => m.time));
  const rangeStart = Math.min(...starts, ...markerTimes, now - 7 * DAY_MS) - 3 * DAY_MS;
  const rangeEnd = Math.max(...ends, ...markerTimes, now + 14 * DAY_MS) + 3 * DAY_MS;
  const span = rangeEnd - rangeStart;
  const pct = (t: number) => ((t - rangeStart) / span) * 100;

  // First day of each month inside the range
  const months: { label: string; left: number }[] = [];
  const cursor = new Date(rangeStart);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  cursor.setMonth(cursor.getMonth() + 1);
  while (cursor.getTime() < rangeEnd) {
    months.push({
      label: cursor.toLocaleDateString('en-US', { month: 'short' }),
      left: pct(cursor.getTime()),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const todayLeft = pct(now);
  const sorted = [...hackathons].sort(
    (a, b) => new Date(a.kickoffDate).getTime() - new Date(b.kickoffDate).getTime()
  );

  return (
    <section aria-labelledby="schedule-heading" className="bg-surface border border-rule rounded-2xl">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-5 pt-5 pb-3">
        <h2 id="schedule-heading" className="font-display text-lg font-semibold">
          Schedule
        </h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {(['in_progress', 'submitted', 'completed', 'not_started'] as const).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_META[s].bar}`} aria-hidden="true" />
              {STATUS_META[s].label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="w-2 h-2 rotate-45 bg-ink border border-surface" aria-hidden="true" />
            Other key dates
          </li>
        </ul>
      </div>

      <div className="px-5 pb-5">
        <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] sm:grid-cols-[minmax(0,12rem)_1fr]">
          {/* Month axis */}
          <div />
          <div className="relative h-7 border-b border-rule text-xs text-ink-3">
            {/* Month labels too close to the Today tag would sit underneath it */}
            {months.filter((m) => Math.abs(m.left - todayLeft) > 5).map((m) => (
              <span
                key={`${m.label}-${m.left}`}
                className="absolute bottom-1.5 -translate-x-1/2"
                style={{ left: `${m.left}%` }}
              >
                {m.label}
              </span>
            ))}
            <span
              className="absolute bottom-1 -translate-x-1/2 bg-highlight text-highlight-ink font-semibold rounded px-1.5 leading-5 z-10"
              style={{ left: `${todayLeft}%` }}
            >
              Today
            </span>
          </div>

          {sorted.map((h, i) => {
            const start = new Date(h.kickoffDate).getTime();
            const hasDeadline = Boolean(h.submissionDeadline);
            const end = hasDeadline ? new Date(h.submissionDeadline as string).getTime() : now;
            const left = pct(start);
            const width = Math.max(pct(end) - left, 1.5);
            const meta = STATUS_META[h.status];
            const overdue = isOverdue(h);
            const summary = `${h.title}: ${meta.label}, ${h.completion}% done, ${
              hasDeadline ? `due ${formatShortDate(h.submissionDeadline)}` : 'no deadline'
            }${overdue ? ', overdue' : ''}`;

            return (
              <React.Fragment key={h.id}>
                <Link
                  to={`/dashboard/hackathons/${h.id}`}
                  className="truncate text-sm text-ink-2 hover:text-accent py-2.5 pr-3 rounded"
                  title={h.title}
                >
                  {h.title}
                </Link>
                <div className="relative py-2.5">
                  {/* Month gridlines */}
                  {months.map((m) => (
                    <span
                      key={`${m.label}-${m.left}`}
                      className="absolute inset-y-0 w-px bg-rule"
                      style={{ left: `${m.left}%` }}
                      aria-hidden="true"
                    />
                  ))}
                  {/* Today line */}
                  <span
                    className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-highlight z-10"
                    style={{ left: `${todayLeft}%` }}
                    aria-hidden="true"
                  />
                  <Link
                    to={`/dashboard/hackathons/${h.id}`}
                    aria-label={summary}
                    title={summary}
                    className={`relative block h-5 rounded-full overflow-hidden animate-grow-x ${
                      hasDeadline ? meta.barSoft : 'border border-dashed border-rule-strong'
                    } ${overdue ? 'ring-2 ring-danger' : ''}`}
                    style={{
                      marginLeft: `${left}%`,
                      width: `${width}%`,
                      animationDelay: `${i * 60}ms`,
                    }}
                  >
                    <span
                      className={`absolute inset-y-0 left-0 ${meta.bar}`}
                      style={{ width: `${h.completion}%` }}
                    />
                  </Link>
                  {markerDates(h).map((m) => (
                    <span
                      key={m.label}
                      className="absolute top-1/2 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink border-2 border-surface z-20"
                      style={{ left: `${pct(m.time)}%` }}
                      title={`${m.label}: ${new Date(m.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-ink-3">
          Bars run from kickoff to submission deadline and fill as tasks are completed. A red outline means the
          deadline passed before it was submitted. Diamonds mark registration, shortlist and final presentation dates.
        </p>
      </div>
    </section>
  );
};
