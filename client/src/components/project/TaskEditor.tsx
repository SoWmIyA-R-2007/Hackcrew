import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { TaskFields } from '@/lib/api';
import { BoardColumn, ProjectTask, ProjectView, TaskPriority } from '@/lib/types';
import { BOARD_COLUMNS, TASK_PRIORITY_META, fromDateInput, timeAgo, toDateInput } from '@/lib/project';
import { Modal } from './Modal';

interface Props {
  task: ProjectTask;
  project: ProjectView;
  currentUserId: string | null;
  now: number;
  onClose: () => void;
  onSave: (changes: Partial<TaskFields>) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}

/** Every field of one card. Only changed fields are sent, so teammates editing other fields are not overwritten */
export const TaskEditor: React.FC<Props> = ({ task, project, currentUserId, now, onClose, onSave, onDelete }) => {
  const [title, setTitle] = useState(task.title);
  const [column, setColumn] = useState<BoardColumn>(task.column);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? '');
  const [dueDate, setDueDate] = useState(toDateInput(task.dueDate));
  const [milestoneId, setMilestoneId] = useState(task.milestoneId ?? '');
  const [notes, setNotes] = useState(task.notes);
  const [pullRequest, setPullRequest] = useState(task.pullRequest ? String(task.pullRequest) : '');
  const [busy, setBusy] = useState(false);

  const nameOf = (id: string | null) => project.members.find((m) => m.userId === id)?.name;
  const draft: TaskFields = {
    title: title.trim(),
    column,
    priority,
    assigneeId: assigneeId || null,
    // Keep the stored time when the picked day did not change
    dueDate: dueDate === toDateInput(task.dueDate) ? task.dueDate : fromDateInput(dueDate),
    milestoneId: milestoneId || null,
    notes,
    pullRequest: Number(pullRequest) > 0 ? Math.floor(Number(pullRequest)) : null,
  };
  const changes = Object.fromEntries(
    (Object.keys(draft) as (keyof TaskFields)[]).filter((k) => draft[k] !== (task[k] ?? null)).map((k) => [k, draft[k]])
  ) as Partial<TaskFields>;
  const changed = Object.keys(changes).length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title) return;
    if (!changed) return onClose();
    setBusy(true);
    const ok = await onSave(changes);
    setBusy(false);
    if (ok) onClose();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete the card "${task.title}"?`)) return;
    setBusy(true);
    const ok = await onDelete();
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title="Card" onClose={onClose}>
      <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
        <div>
          <label htmlFor="te-title" className="field-label">
            Title
          </label>
          <input id="te-title" required maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} className="field" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="te-column" className="field-label">
              Column
            </label>
            <select id="te-column" value={column} onChange={(e) => setColumn(e.target.value as BoardColumn)} className="field">
              {BOARD_COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="te-priority" className="field-label">
              Priority
            </label>
            <select id="te-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="field">
              {(Object.keys(TASK_PRIORITY_META) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_META[p].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="te-assignee" className="field-label">
                Assignee
              </label>
              {currentUserId && assigneeId !== currentUserId && (
                <button type="button" onClick={() => setAssigneeId(currentUserId)} className="text-xs text-accent hover:underline mb-1.5">
                  Take it
                </button>
              )}
            </div>
            <select id="te-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="field">
              <option value="">Unassigned</option>
              {project.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                  {m.userId === currentUserId ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="te-due" className="field-label">
              Due date
            </label>
            <input id="te-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="field" />
          </div>
        </div>
        {project.milestones.length > 0 && (
          <div>
            <label htmlFor="te-milestone" className="field-label">
              Milestone
            </label>
            <select id="te-milestone" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)} className="field">
              <option value="">None</option>
              {project.milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                  {m.done ? ' (reached)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        {project.github && (
          <div>
            <label htmlFor="te-pull" className="field-label">
              Pull request on {project.github.repo}
            </label>
            {project.github.pulls.length > 0 ? (
              <select id="te-pull" value={pullRequest} onChange={(e) => setPullRequest(e.target.value)} className="field">
                <option value="">None</option>
                {/* Keep a linked number selectable even if it is no longer among the recent ones */}
                {pullRequest && !project.github.pulls.some((p) => String(p.number) === pullRequest) && (
                  <option value={pullRequest}>#{pullRequest}</option>
                )}
                {project.github.pulls.map((p) => (
                  <option key={p.number} value={p.number}>
                    #{p.number} {p.title} ({p.state})
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="te-pull"
                type="number"
                min={1}
                inputMode="numeric"
                value={pullRequest}
                onChange={(e) => setPullRequest(e.target.value)}
                placeholder="Number, e.g. 12"
                className="field"
              />
            )}
            <p className="mt-1 text-xs text-ink-3">The card moves to Done when this pull request is merged.</p>
          </div>
        )}
        <div>
          <label htmlFor="te-notes" className="field-label">
            Notes
          </label>
          <textarea
            id="te-notes"
            rows={4}
            maxLength={5000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Details, links, acceptance checks"
            className="field resize-y"
          />
        </div>

        <p className="text-xs text-ink-3">
          Added {timeAgo(task.createdAt, now)}
          {task.assigneeId && task.assignedBy && task.assignedAt && (
            <>
              {' · '}
              {task.assignedBy === task.assigneeId
                ? `${nameOf(task.assigneeId) ?? 'Someone'} took it ${timeAgo(task.assignedAt, now)}`
                : `assigned by ${nameOf(task.assignedBy) ?? 'a former collaborator'} ${timeAgo(task.assignedAt, now)}`}
            </>
          )}
          {task.completedAt && ` · done ${timeAgo(task.completedAt, now)}`}
        </p>

        <div className="flex items-center justify-between gap-2 pt-4 border-t border-rule">
          <button type="button" onClick={handleDelete} disabled={busy} className="btn btn-danger">
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !draft.title}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
