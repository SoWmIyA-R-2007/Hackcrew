import React from 'react';
import { Link } from 'react-router';
import { ExternalLink, Trophy } from 'lucide-react';
import { ProfileHackathon } from '@/lib/types';
import { OUTCOME_LABEL } from '@/lib/hackathon';

interface Props {
  hackathons: ProfileHackathon[];
  // Settings mode: links to the hackathon and a switch to hide it from the public page
  onToggleHidden?: (id: string, hidden: boolean) => void;
}

const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function dateRange(h: ProfileHackathon) {
  const end = h.finalPresentationDate ?? h.submissionDeadline;
  if (!end) return monthYear(h.kickoffDate);
  const sameYear = new Date(end).getFullYear() === new Date(h.kickoffDate).getFullYear();
  return `${shortDate(h.kickoffDate)} – ${shortDate(end)}${sameYear ? `, ${new Date(end).getFullYear()}` : ` ${new Date(end).getFullYear()}`}`;
}

export const ProfileHackathonList: React.FC<Props> = ({ hackathons, onToggleHidden }) => (
  <ul className="divide-y divide-rule">
    {hackathons.map((h) => {
      const won = h.result.outcome === 'winner';
      const hasResult = h.result.outcome !== 'pending';
      return (
        <li key={h.id} className={`py-4 flex gap-4 ${h.hidden ? 'opacity-60' : ''}`}>
          <span
            className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              won ? 'bg-highlight text-highlight-ink' : 'bg-sunken text-ink-3'
            }`}
            aria-hidden="true"
          >
            <Trophy className="w-4 h-4" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              {onToggleHidden ? (
                <Link to={`/dashboard/hackathons/${h.id}`} className="font-medium text-ink hover:text-accent">
                  {h.title}
                </Link>
              ) : (
                <h3 className="font-medium text-ink">{h.title}</h3>
              )}
              <span className="text-sm text-ink-3 tabular-nums">{dateRange(h)}</span>
            </div>
            <p className="text-sm text-ink-2">
              Team {h.teamName}
              {h.domain && `, ${h.domain}`}
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-accent-soft text-accent font-medium">{h.position}</span>
              {h.role && h.role.toLowerCase() !== h.position.toLowerCase() && (
                <span className="px-2 py-0.5 rounded-md bg-sunken text-ink-2">{h.role}</span>
              )}
              {hasResult && (
                <span
                  className={`px-2 py-0.5 rounded-md font-medium ${won ? 'bg-highlight text-highlight-ink' : 'bg-sunken text-ink-2'}`}
                >
                  {OUTCOME_LABEL[h.result.outcome]}
                </span>
              )}
            </div>

            {(h.result.placement || h.result.prize) && (
              <p className="mt-2 text-sm text-ink">
                {h.result.placement}
                {h.result.placement && h.result.prize && ', '}
                {h.result.prize && <span className="font-medium">prize: {h.result.prize}</span>}
              </p>
            )}

            {h.projectUrl && (
              <a
                href={h.projectUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-1.5 inline-flex items-center gap-1 text-sm text-accent hover:underline"
              >
                See the project
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {onToggleHidden && (
            <label className="shrink-0 flex items-start gap-2 text-xs text-ink-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={!h.hidden}
                onChange={(e) => onToggleHidden(h.id, !e.target.checked)}
                className="w-4 h-4 accent-[var(--accent)]"
              />
              <span className="hidden sm:inline">Show publicly</span>
              <span className="sr-only sm:hidden">Show {h.title} on your public profile</span>
            </label>
          )}
        </li>
      );
    })}
  </ul>
);
