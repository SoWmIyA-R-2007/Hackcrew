import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Navbar } from '@/components/Navbar';
import { InlineError } from '@/components/ErrorScreen';
import { PageSkeleton } from '@/components/Loading';
import { api } from '@/lib/api';
import { HackathonOutcome, HackathonView } from '@/lib/types';
import { OUTCOME_LABEL } from '@/lib/hackathon';

const MONTHS_SHOWN = 12;

/** The last 12 calendar months, oldest first, with how many hackathons kicked off in each */
function perMonth(list: HackathonView[], now: Date) {
  const months = Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_SHOWN - 1 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-US', { month: 'short' }), year: d.getFullYear(), count: 0, titles: [] as string[] };
  });
  for (const h of list) {
    const d = new Date(h.kickoffDate);
    const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (m) {
      m.count++;
      m.titles.push(h.title);
    }
  }
  return months;
}

function countBy<T extends string>(list: HackathonView[], key: (h: HackathonView) => T) {
  const counts = new Map<T, number>();
  for (const h of list) counts.set(key(h), (counts.get(key(h)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '–');

function StatTile({ value, label, note }: { value: string | number; label: string; note?: string }) {
  return (
    <div className="bg-surface border border-rule rounded-2xl px-5 py-4">
      <p className="font-display text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm text-ink-2 mt-1">{label}</p>
      {note && <p className="text-xs text-ink-3 mt-0.5">{note}</p>}
    </div>
  );
}

/** Horizontal bars for one measure; the value is written next to each bar, in ink, not the bar colour */
function BarList({ rows, total }: { rows: [string, number][]; total: number }) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <ul className="space-y-2.5">
      {rows.map(([label, n]) => (
        <li key={label} className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-3 text-sm">
          <span className="truncate text-ink-2" title={label}>
            {label}
          </span>
          <span className="h-3 bg-sunken rounded-r-[4px] overflow-hidden">
            <span className="block h-full bg-accent rounded-r-[4px]" style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className="tabular-nums text-ink text-right">
            {n} <span className="text-ink-3 text-xs">{percent(n, total)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function StatsPage() {
  const [list, setList] = useState<HackathonView[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [now] = useState(() => new Date());

  useEffect(() => {
    api
      .listHackathons()
      .then(setList)
      .catch(setError);
  }, [reloadKey]);

  const all = list ?? [];
  const finished = all.filter((h) => h.status === 'submitted' || h.status === 'completed');
  const withResult = all.filter((h) => h.result.outcome !== 'pending');
  const reachedShortlist = withResult.filter((h) => ['shortlisted', 'finalist', 'winner'].includes(h.result.outcome));
  const wins = withResult.filter((h) => h.result.outcome === 'winner');
  const months = perMonth(all, now);
  const monthMax = Math.max(1, ...months.map((m) => m.count));
  const tracks = countBy(all, (h) => h.domain || 'No track');
  const outcomes = countBy(withResult, (h) => h.result.outcome).map(
    ([o, n]) => [OUTCOME_LABEL[o as HackathonOutcome], n] as [string, number]
  );

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Stats</h1>
        <p className="mt-2 text-ink-2 max-w-2xl">
          How your hackathons have gone so far. Results come from the Result section on each hackathon.
        </p>

        {error !== null && (
          <div className="mt-6">
            <InlineError
              error={error}
              what="your stats"
              onRetry={() => {
                setError(null);
                setReloadKey((k) => k + 1);
              }}
            />
          </div>
        )}
        {!list && error === null && (
          <div className="mt-8">
            <PageSkeleton layout="stats" label="Loading your stats" />
          </div>
        )}

        {list && all.length === 0 && (
          <div className="mt-8 border border-dashed border-rule-strong rounded-2xl px-6 py-12 text-center">
            <p className="font-display text-xl font-semibold">No hackathons yet</p>
            <p className="mt-1 text-sm text-ink-2">Stats appear once you add hackathons and record their results.</p>
            <Link to="/dashboard" className="btn btn-primary mt-5">
              Go to your hackathons
            </Link>
          </div>
        )}

        {list && all.length > 0 && (
          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile value={all.length} label="Hackathons tracked" />
              <StatTile value={finished.length} label="Submitted or completed" note={`${percent(finished.length, all.length)} of all`} />
              <StatTile
                value={reachedShortlist.length}
                label="Shortlisted or better"
                note={withResult.length ? `${percent(reachedShortlist.length, withResult.length)} of results recorded` : 'No results recorded yet'}
              />
              <StatTile
                value={wins.length}
                label="Prizes won"
                note={withResult.length ? `Win rate ${percent(wins.length, withResult.length)}` : undefined}
              />
            </div>

            <section aria-labelledby="per-month-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
              <h2 id="per-month-heading" className="font-display text-lg font-semibold">
                Hackathons per month
              </h2>
              <p className="text-sm text-ink-3">By kickoff date, last 12 months</p>

              <div className="mt-5 relative" aria-hidden="true">
                {/* Recessive gridline at the top value */}
                <div className="absolute left-0 right-0 top-0 border-t border-dashed border-rule" />
                <span className="absolute -top-2.5 right-0 bg-surface pl-1 text-xs text-ink-3 tabular-nums">{monthMax}</span>
                <div className="flex items-end gap-[2px] h-40 border-b border-rule-strong">
                  {months.map((m) => (
                    <div key={m.key} className="group relative flex-1 h-full flex items-end justify-center">
                      {m.count > 0 && (
                        <div
                          className="w-full max-w-9 bg-accent rounded-t-[4px] group-hover:opacity-80 transition-opacity"
                          style={{ height: `${(m.count / monthMax) * 100}%` }}
                        />
                      )}
                      {/* Hover tooltip; the whole column is the hit target */}
                      <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 w-max max-w-56 bg-ink text-paper text-xs rounded-lg px-2.5 py-1.5 shadow-lg">
                        <p className="font-semibold">
                          {m.label} {m.year}: {m.count} {m.count === 1 ? 'hackathon' : 'hackathons'}
                        </p>
                        {m.titles.slice(0, 3).map((t) => (
                          <p key={t} className="truncate opacity-80">
                            {t}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-[2px] mt-1.5">
                  {months.map((m, i) => (
                    <span key={m.key} className="flex-1 text-center text-xs text-ink-3">
                      {/* Label every other month on narrow screens to avoid collisions */}
                      <span className={i % 2 ? 'hidden sm:inline' : ''}>{m.label}</span>
                    </span>
                  ))}
                </div>
              </div>

              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-ink-2 hover:text-ink">Show as a table</summary>
                <table className="mt-2 w-full max-w-sm text-left">
                  <thead>
                    <tr className="text-ink-3">
                      <th className="font-medium py-1">Month</th>
                      <th className="font-medium py-1 text-right">Hackathons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => (
                      <tr key={m.key} className="border-t border-rule">
                        <td className="py-1">
                          {m.label} {m.year}
                        </td>
                        <td className="py-1 text-right tabular-nums">{m.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section aria-labelledby="tracks-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
                <h2 id="tracks-heading" className="font-display text-lg font-semibold">
                  Tracks entered
                </h2>
                <p className="text-sm text-ink-3 mb-4">Share of all hackathons</p>
                <BarList rows={tracks} total={all.length} />
              </section>

              <section aria-labelledby="outcomes-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
                <h2 id="outcomes-heading" className="font-display text-lg font-semibold">
                  Results
                </h2>
                <p className="text-sm text-ink-3 mb-4">
                  {withResult.length
                    ? `Of ${withResult.length} hackathons with a recorded result`
                    : 'Record results on each hackathon to see them here'}
                </p>
                {withResult.length > 0 && <BarList rows={outcomes} total={withResult.length} />}
              </section>
            </div>

            {wins.length > 0 && (
              <section aria-labelledby="wins-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
                <h2 id="wins-heading" className="font-display text-lg font-semibold">
                  Wins
                </h2>
                <ul className="mt-3 divide-y divide-rule text-sm">
                  {wins.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                      <Link to={`/dashboard/hackathons/${h.id}`} className="font-medium hover:text-accent">
                        {h.title}
                      </Link>
                      <span className="text-ink-2">
                        {[h.result.placement, h.result.prize].filter(Boolean).join(', ') || 'Prize won'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
