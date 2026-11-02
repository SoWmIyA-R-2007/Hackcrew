import React, { useState } from 'react';
import { ProjectActivity } from '@/lib/types';
import { timeAgo } from '@/lib/project';

interface Props {
  activity: ProjectActivity[];
  currentUserId: string | null;
  now: number;
}

const FIRST = 8;

/** The project's history, newest first */
export const ActivityPanel: React.FC<Props> = ({ activity, currentUserId, now }) => {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? activity : activity.slice(0, FIRST);
  return (
    <section aria-labelledby="activity-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
      <h2 id="activity-heading" className="font-display text-lg font-semibold">
        Activity
      </h2>
      {activity.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">Changes to cards, milestones and people will show up here.</p>
      ) : (
        <ol className="mt-3 space-y-3 border-l border-rule ml-1">
          {shown.map((a) => (
            <li key={a.id} className="relative pl-4">
              <span className="absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full bg-rule-strong" aria-hidden="true" />
              <p className="text-sm text-ink-2">
                <span className="font-medium text-ink">{a.actorId === currentUserId ? 'You' : a.actorName}</span> {a.text}
              </p>
              <p className="text-xs text-ink-3">
                <time dateTime={a.at} title={new Date(a.at).toLocaleString()}>
                  {timeAgo(a.at, now)}
                </time>
              </p>
            </li>
          ))}
        </ol>
      )}
      {activity.length > FIRST && (
        <button onClick={() => setShowAll((v) => !v)} className="btn btn-ghost text-sm mt-3 -ml-2" aria-expanded={showAll}>
          {showAll ? 'Show less' : `Show all ${activity.length}`}
        </button>
      )}
    </section>
  );
};
