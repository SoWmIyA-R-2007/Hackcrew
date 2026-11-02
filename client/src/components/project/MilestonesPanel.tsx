import React, { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Milestone, ProjectView } from '@/lib/types';
import { dueLabel, fromDateInput } from '@/lib/project';

interface Props {
  project: ProjectView;
  now: number;
  onAdd: (milestone: Pick<Milestone, 'title' | 'dueDate'>) => Promise<boolean>;
  onToggle: (milestone: Milestone) => void;
  onDelete: (milestone: Milestone) => void;
}

const byDue = (a: Milestone, b: Milestone) =>
  (a.dueDate ? Date.parse(a.dueDate) : Infinity) - (b.dueDate ? Date.parse(b.dueDate) : Infinity);

/** Checkpoints such as "Demo-ready build", each with the share of its cards that are done */
export const MilestonesPanel: React.FC<Props> = ({ project, now, onAdd, onToggle, onDelete }) => {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const milestones = [...project.milestones].sort(byDue);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    if (await onAdd({ title: title.trim(), dueDate: fromDateInput(dueDate) })) {
      setTitle('');
      setDueDate('');
    }
    setBusy(false);
  };

  return (
    <section aria-labelledby="milestones-heading" className="bg-surface border border-rule rounded-2xl">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3">
        <h2 id="milestones-heading" className="font-display text-lg font-semibold">
          Milestones
        </h2>
        {milestones.length > 0 && (
          <span className="text-sm text-ink-3">
            {milestones.filter((m) => m.done).length} of {milestones.length} reached
          </span>
        )}
      </div>

      {milestones.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-ink-2">
          Add checkpoints such as "Working prototype" or "Demo-ready", then pick one on each card to see how close you are.
        </p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {milestones.map((m) => {
            const cards = project.tasks.filter((t) => t.milestoneId === m.id);
            const done = cards.filter((t) => t.column === 'done').length;
            const pct = cards.length ? Math.round((done / cards.length) * 100) : 0;
            const late = !m.done && m.dueDate && Date.parse(m.dueDate) < now;
            return (
              <li key={m.id} className="flex items-start gap-3 px-5 py-3">
                <button
                  onClick={() => onToggle(m)}
                  role="checkbox"
                  aria-checked={m.done}
                  aria-label={`${m.title} reached`}
                  className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                    m.done ? 'bg-ok border-ok text-white' : 'border-rule-strong bg-surface hover:border-accent'
                  }`}
                >
                  {m.done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`text-sm font-medium ${m.done ? 'text-ink-3 line-through' : ''}`}>{m.title}</p>
                    {m.dueDate && (
                      <span className={`text-xs shrink-0 tabular-nums ${late ? 'text-danger font-medium' : 'text-ink-3'}`}>
                        {m.done ? 'Reached' : dueLabel(m.dueDate, now)}
                      </span>
                    )}
                  </div>
                  {cards.length > 0 ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-sunken rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${m.done ? 'bg-ok' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-ink-3 tabular-nums">
                        {done}/{cards.length}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-3 mt-0.5">No cards yet</p>
                  )}
                </div>
                <button
                  onClick={() => confirm(`Delete the milestone "${m.title}"? Its cards stay on the board.`) && onDelete(m)}
                  className="icon-btn w-7 h-7 shrink-0"
                  aria-label={`Delete milestone ${m.title}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="ms-title">
          Milestone name
        </label>
        <input
          id="ms-title"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New milestone"
          className="field flex-1 min-w-[10rem]"
        />
        <label className="sr-only" htmlFor="ms-due">
          Due date
        </label>
        <input id="ms-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="field w-auto" />
        <button type="submit" className="btn btn-secondary" disabled={busy || !title.trim()}>
          Add
        </button>
      </form>
    </section>
  );
};
