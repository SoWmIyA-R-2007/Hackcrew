import { ProfileHackathon } from './types';

// A hackathon that runs longer than this is counted only for its first weeks, so one long event can't fill the year
const MAX_SPAN_DAYS = 60;

export interface HeatDay {
  date: Date;
  count: number;
  titles: string[];
  // Days after today are drawn empty
  future: boolean;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * One column per week for the last year, ending with the current week (columns start on Sunday).
 * Each day counts the hackathons the person was taking part in: kickoff through to the later of the
 * submission deadline and the final presentation.
 */
export function buildHeatmap(hackathons: ProfileHackathon[], today: Date) {
  const end = startOfDay(today);
  const first = new Date(end);
  first.setDate(first.getDate() - 52 * 7 - first.getDay());
  const lastShown = new Date(end);
  lastShown.setDate(lastShown.getDate() + (6 - end.getDay()));

  // Step by calendar date (not 24 hours) so daylight-saving changes never skip or repeat a day
  const days = new Map<string, HeatDay>();
  const weeks: HeatDay[][] = [];
  for (const d = new Date(first); d <= lastShown; d.setDate(d.getDate() + 1)) {
    const day: HeatDay = { date: new Date(d), count: 0, titles: [], future: d > end };
    days.set(dayKey(day.date), day);
    if (d.getDay() === 0) weeks.push([]);
    weeks[weeks.length - 1].push(day);
  }

  for (const h of hackathons) {
    const start = startOfDay(new Date(h.kickoffDate));
    const finish = [h.submissionDeadline, h.finalPresentationDate]
      .filter((v): v is string => Boolean(v))
      .map((v) => startOfDay(new Date(v)).getTime())
      .reduce((a, b) => Math.max(a, b), start.getTime());
    const capped = new Date(start);
    capped.setDate(capped.getDate() + MAX_SPAN_DAYS - 1);
    const last = Math.min(finish, capped.getTime());
    for (const d = new Date(start); d.getTime() <= last; d.setDate(d.getDate() + 1)) {
      const day = days.get(dayKey(d));
      if (day && !day.future) {
        day.count++;
        day.titles.push(h.title);
      }
    }
  }

  const all = [...days.values()].filter((d) => !d.future);
  const activeDays = all.filter((d) => d.count > 0).length;
  const busiest = all.reduce((a, b) => (b.count > a.count ? b : a), all[0]);
  return { weeks, activeDays, busiest: busiest?.count ? busiest : null };
}

/** 0 for an empty day, then one step per extra hackathon up to 4 */
export const heatLevel = (count: number) => Math.min(count, 4);
