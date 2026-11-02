import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ProfileHackathon } from '@/lib/types';
import { buildHeatmap, heatLevel, type HeatDay } from '@/lib/heatmap';

const LEVEL_CLASS = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'];
const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

interface Props {
  hackathons: ProfileHackathon[];
  // Name used in the summary sentence, e.g. "You" or the person's first name
  subject: string;
}

const fullDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export const ActivityHeatmap: React.FC<Props> = ({ hackathons, subject }) => {
  // Captured once per mount so renders stay pure
  const [today] = useState(() => new Date());
  const { weeks, activeDays, busiest } = useMemo(() => buildHeatmap(hackathons, today), [hackathons, today]);
  const [hover, setHover] = useState<{ day: HeatDay; left: number; top: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Start scrolled to the most recent weeks when the grid is wider than the screen
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, []);

  // A month label sits above the first week that starts in that month
  const monthLabels = weeks.map((week, i) => {
    const first = week[0].date;
    const prev = weeks[i - 1]?.[0].date;
    // The last two weeks have no room for a label without running past the edge
    if (i >= weeks.length - 2) return '';
    return !prev || prev.getMonth() !== first.getMonth() ? first.toLocaleDateString('en-US', { month: 'short' }) : '';
  });

  const summary =
    activeDays === 0
      ? `${subject} had no hackathons running in the last year.`
      : `${subject} took part in hackathons on ${activeDays} ${activeDays === 1 ? 'day' : 'days'} in the last year${
          busiest && busiest.count > 1 ? `, with up to ${busiest.count} at once` : ''
        }.`;

  const showTip = (day: HeatDay, e: React.MouseEvent<HTMLSpanElement>) => {
    const cell = e.currentTarget.getBoundingClientRect();
    const box = scroller.current!.getBoundingClientRect();
    setHover({ day, left: cell.left - box.left + scroller.current!.scrollLeft + cell.width / 2, top: cell.top - box.top });
  };

  return (
    <div>
      <p className="text-sm text-ink-2">{summary}</p>

      <div ref={scroller} className="relative mt-3 overflow-x-auto pb-1" onMouseLeave={() => setHover(null)}>
        {/* Squares grow to fill the width; below about 560px the grid scrolls instead of shrinking further */}
        <div
          className="grid gap-x-2 min-w-[560px]"
          style={{ gridTemplateColumns: 'auto minmax(0, 1fr)' }}
          role="img"
          aria-label={summary}
        >
          <div />
          <div
            className="grid gap-[2px] h-4 text-[11px] text-ink-3"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {weeks.map((_, i) => (
              <span key={i} className="whitespace-nowrap overflow-visible">
                {monthLabels[i]}
              </span>
            ))}
          </div>

          <div className="grid grid-rows-7 gap-[2px] text-[10px] text-ink-3" aria-hidden="true">
            {WEEKDAY_LABELS.map((label, i) => (
              <span key={i} className="flex items-center">
                {label}
              </span>
            ))}
          </div>
          <div
            className="grid gap-[2px]"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {weeks.map((week, i) => (
              <div key={i} className="grid grid-rows-7 grid-cols-[minmax(0,1fr)] gap-[2px]">
                {week.map((day) => (
                  <span
                    key={day.date.toISOString()}
                    onMouseEnter={(e) => !day.future && showTip(day, e)}
                    className={`block w-full aspect-square rounded-[2px] ${
                      day.future ? 'bg-transparent' : LEVEL_CLASS[heatLevel(day.count)]
                    } ${hover?.day === day ? 'ring-2 ring-ink ring-offset-1 ring-offset-surface' : ''}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full -mt-1.5 w-max max-w-64 bg-ink text-paper text-xs rounded-lg px-2.5 py-1.5 shadow-lg"
            style={{ left: hover.left, top: hover.top }}
          >
            <p className="font-semibold">
              {hover.day.count === 0
                ? 'No hackathons'
                : `${hover.day.count} ${hover.day.count === 1 ? 'hackathon' : 'hackathons'}`}{' '}
              on {fullDate(hover.day.date)}
            </p>
            {hover.day.titles.slice(0, 4).map((t) => (
              <p key={t} className="truncate opacity-80">
                {t}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-ink-3" aria-hidden="true">
        Fewer
        {LEVEL_CLASS.map((c) => (
          <span key={c} className={`w-[11px] h-[11px] rounded-[2px] ${c}`} />
        ))}
        More hackathons at once
      </div>
    </div>
  );
};
