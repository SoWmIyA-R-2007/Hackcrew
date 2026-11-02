import { BoardColumn, ProjectStatus, ProjectTask, TaskPriority } from './types';

export const BOARD_COLUMNS: { id: BoardColumn; label: string; hint: string }[] = [
  { id: 'backlog', label: 'Backlog', hint: 'Ideas and later work' },
  { id: 'todo', label: 'To do', hint: 'Ready to pick up' },
  { id: 'in_progress', label: 'In progress', hint: 'Someone is on it' },
  { id: 'review', label: 'In review', hint: 'Waiting for a check' },
  { id: 'done', label: 'Done', hint: 'Finished' },
];

export const COLUMN_LABEL = Object.fromEntries(BOARD_COLUMNS.map((c) => [c.id, c.label])) as Record<BoardColumn, string>;

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; badge: string; bar: string }> = {
  idea: { label: 'Idea', badge: 'bg-sunken text-ink-2', bar: 'bg-ink-3' },
  building: { label: 'Building', badge: 'bg-accent-soft text-accent', bar: 'bg-accent' },
  paused: { label: 'Paused', badge: 'bg-warn-soft text-warn', bar: 'bg-warn' },
  shipped: { label: 'Shipped', badge: 'bg-ok-soft text-ok', bar: 'bg-ok' },
  archived: { label: 'Archived', badge: 'bg-sunken text-ink-3', bar: 'bg-ink-3' },
};

export const PROJECT_STATUSES = Object.keys(PROJECT_STATUS_META) as ProjectStatus[];

export const TASK_PRIORITY_META: Record<TaskPriority, { label: string; dot: string; rank: number }> = {
  high: { label: 'High', dot: 'bg-danger', rank: 0 },
  medium: { label: 'Medium', dot: 'bg-warn', rank: 1 },
  low: { label: 'Low', dot: 'bg-ink-3', rank: 2 },
};

export function isCardOverdue(task: Pick<ProjectTask, 'column' | 'dueDate'>, now: number) {
  return task.column !== 'done' && Boolean(task.dueDate) && new Date(task.dueDate!).getTime() < now;
}

/** Board order inside a column: high priority first, then the soonest due date, then oldest */
export function byBoardOrder(a: ProjectTask, b: ProjectTask) {
  const rank = TASK_PRIORITY_META[a.priority].rank - TASK_PRIORITY_META[b.priority].rank;
  if (rank) return rank;
  const due = (a.dueDate ? Date.parse(a.dueDate) : Infinity) - (b.dueDate ? Date.parse(b.dueDate) : Infinity);
  if (due) return due;
  return a.createdAt.localeCompare(b.createdAt);
}

/** Splits "React, Node.js,  MongoDB" into tags */
export const parseTechStack = (value: string) =>
  value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);

/** "3h ago", "2d ago", or a date for anything older than a week */
export function timeAgo(iso: string, now: number) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days}d ago`;
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** An ISO time as a value for <input type="date">, in the viewer's time zone */
export function toDateInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A picked date as an ISO time at the end of that day, so a card due "today" is overdue only tomorrow */
export const fromDateInput = (value: string) => (value ? new Date(`${value}T23:59:00`).toISOString() : null);

/** "Due today", "Due in 3 days", "2 days late" for a card or milestone */
export function dueLabel(iso: string, now: number) {
  const startOf = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((startOf(new Date(iso).getTime()) - startOf(now)) / (24 * 60 * 60 * 1000));
  if (days === 0) return new Date(iso).getTime() < now ? 'Late today' : 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return days <= 14 ? `Due in ${days} days` : `Due ${new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  return days === -1 ? '1 day late' : `${-days} days late`;
}
