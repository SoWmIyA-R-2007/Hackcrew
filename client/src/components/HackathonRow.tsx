import React from 'react';
import { Link } from 'react-router';
import { HackathonView } from '@/lib/types';
import { Pencil } from 'lucide-react';
import {
  STATUS_META,
  describeDeadline,
  formatShortDate,
  isOverdue,
} from '@/lib/utils';

interface HackathonRowProps {
  hackathon: HackathonView;
  onEdit?: (hackathon: HackathonView) => void;
}

export const HackathonRow: React.FC<HackathonRowProps> = ({ hackathon: h, onEdit }) => {
  const meta = STATUS_META[h.status];
  const overdue = isOverdue(h);
  const finished = h.status === 'submitted' || h.status === 'completed';

  return (
    <li className="relative grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,1fr)_8rem_9rem_10rem_2.25rem] items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-sunken/60 transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {h.priority === 'high' && (
            <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" title="High priority" />
          )}
          {/* The title link covers the whole row so any click opens the hackathon */}
          <Link
            to={`/dashboard/hackathons/${h.id}`}
            className="font-medium text-ink truncate hover:text-accent after:absolute after:inset-0 rounded"
          >
            {h.title}
          </Link>
          {h.priority === 'high' && <span className="sr-only">(high priority)</span>}
          {h.role === 'member' && (
            <span className="text-[11px] font-medium text-accent bg-accent-soft rounded px-1.5 py-0.5 shrink-0">
              Shared
            </span>
          )}
        </div>
        <p className="text-sm text-ink-3 truncate mt-0.5">
          {h.teamName} in {h.domain}
        </p>
      </div>

      <span
        className={`justify-self-end md:justify-self-start text-xs font-medium px-2 py-1 rounded-md ${meta.badge}`}
      >
        {meta.label}
      </span>

      <div className="flex items-center gap-2.5" aria-label={`${h.completion}% of tasks done`}>
        <div className="flex-1 h-1.5 bg-sunken rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${h.completion}%` }} />
        </div>
        <span className="text-xs text-ink-2 tabular-nums w-9 text-right">{h.completion}%</span>
      </div>

      <div className="text-sm justify-self-end md:justify-self-start text-right md:text-left">
        <div className="text-ink tabular-nums">{formatShortDate(h.submissionDeadline)}</div>
        <div className={`text-xs ${overdue ? 'text-danger font-medium' : 'text-ink-3'}`}>
          {finished ? meta.label : describeDeadline(h.submissionDeadline)}
        </div>
      </div>

      {onEdit && (
        <button
          onClick={() => onEdit(h)}
          className="icon-btn relative z-10 hidden md:inline-flex"
          aria-label={`Edit ${h.title}`}
          title="Edit details"
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}
    </li>
  );
};
