import React, { useState } from 'react';
import { Flag, GitPullRequest, Plus } from 'lucide-react';
import { BoardColumn, ProjectTask, ProjectView } from '@/lib/types';
import { BOARD_COLUMNS, TASK_PRIORITY_META, byBoardOrder, dueLabel, isCardOverdue } from '@/lib/project';
import { getInitials } from '@/lib/utils';

interface Props {
  project: ProjectView;
  currentUserId: string | null;
  now: number;
  onMove: (taskId: string, column: BoardColumn) => void;
  onAdd: (column: BoardColumn, title: string) => Promise<boolean>;
  onOpen: (task: ProjectTask) => void;
}

type AssigneeFilter = 'all' | 'me' | 'unassigned' | string;

function TaskCard({
  task,
  project,
  now,
  onOpen,
}: {
  task: ProjectTask;
  project: ProjectView;
  now: number;
  onOpen: (task: ProjectTask) => void;
}) {
  const assignee = project.members.find((m) => m.userId === task.assigneeId);
  const milestone = project.milestones.find((m) => m.id === task.milestoneId);
  const pull = task.pullRequest ? project.github?.pulls.find((p) => p.number === task.pullRequest) : undefined;
  const overdue = isCardOverdue(task, now);
  const priority = TASK_PRIORITY_META[task.priority];
  const done = task.column === 'done';
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="bg-surface border border-rule rounded-xl hover:border-rule-strong transition-colors cursor-grab active:cursor-grabbing"
    >
      <button onClick={() => onOpen(task)} className="w-full text-left px-3 py-2.5 rounded-xl cursor-pointer">
        <span className="flex items-start gap-2">
          <span
            className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${priority.dot}`}
            title={`${priority.label} priority`}
            aria-hidden="true"
          />
          <span className={`text-sm leading-snug ${done ? 'text-ink-3 line-through' : 'text-ink'}`}>{task.title}</span>
        </span>
        <span className="sr-only">, {priority.label} priority</span>
        {(milestone || task.dueDate || assignee || task.pullRequest) && (
          <span className="mt-2 flex flex-wrap items-center gap-1.5 pl-4">
            {milestone && (
              <span className="inline-flex items-center gap-1 text-[11px] text-ink-2 bg-sunken rounded px-1.5 py-0.5 max-w-[10rem]">
                <Flag className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{milestone.title}</span>
              </span>
            )}
            {task.pullRequest && (
              <span
                className={`inline-flex items-center gap-0.5 text-[11px] rounded px-1.5 py-0.5 tabular-nums ${
                  pull?.state === 'merged' ? 'bg-accent-soft text-accent' : 'bg-sunken text-ink-2'
                }`}
                title={pull ? `#${pull.number} ${pull.title} (${pull.state})` : `Pull request #${task.pullRequest}`}
              >
                <GitPullRequest className="w-3 h-3" aria-hidden="true" />#{task.pullRequest}
              </span>
            )}
            {task.dueDate && !done && (
              <span
                className={`text-[11px] rounded px-1.5 py-0.5 tabular-nums ${
                  overdue ? 'bg-danger-soft text-danger font-medium' : 'bg-sunken text-ink-2'
                }`}
              >
                {dueLabel(task.dueDate, now)}
              </span>
            )}
            <span className="flex-1" />
            {assignee && (
              <span
                title={`Assigned to ${assignee.name}`}
                className="w-6 h-6 rounded-full bg-accent-soft text-accent text-[10px] font-semibold flex items-center justify-center"
              >
                {getInitials(assignee.name)}
                <span className="sr-only">, assigned to {assignee.name}</span>
              </span>
            )}
          </span>
        )}
      </button>
    </li>
  );
}

function QuickAdd({ column, onAdd }: { column: BoardColumn; onAdd: Props['onAdd'] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-ghost w-full justify-start text-sm px-2 py-1.5">
        <Plus className="w-4 h-4" />
        Add a card
      </button>
    );
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    if (await onAdd(column, title.trim())) setTitle('');
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="sr-only" htmlFor={`add-${column}`}>
        New card title
      </label>
      <input
        id={`add-${column}`}
        autoFocus
        value={title}
        maxLength={300}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="What needs doing?"
        className="field"
      />
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary text-sm py-1" disabled={busy || !title.trim()}>
          Add
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost text-sm py-1">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Kanban board: drag cards between columns, or open a card to change its column, assignee and dates */
export const ProjectBoard: React.FC<Props> = ({ project, currentUserId, now, onMove, onAdd, onOpen }) => {
  const [assignee, setAssignee] = useState<AssigneeFilter>('all');
  const [milestone, setMilestone] = useState('all');
  const [query, setQuery] = useState('');
  const [dragOver, setDragOver] = useState<BoardColumn | null>(null);

  const matches = (t: ProjectTask) =>
    (assignee === 'all' ||
      (assignee === 'me' && t.assigneeId === currentUserId) ||
      (assignee === 'unassigned' && !t.assigneeId) ||
      t.assigneeId === assignee) &&
    (milestone === 'all' || (milestone === 'none' ? !t.milestoneId : t.milestoneId === milestone)) &&
    (!query.trim() || `${t.title} ${t.notes}`.toLowerCase().includes(query.trim().toLowerCase()));
  const visible = project.tasks.filter(matches);
  const filtering = visible.length !== project.tasks.length;

  return (
    <section aria-labelledby="board-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="board-heading" className="font-display text-xl font-semibold">
          Board
          {filtering && (
            <span className="ml-2 text-sm font-normal text-ink-3">
              showing {visible.length} of {project.tasks.length}
            </span>
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="board-search">
            Search cards
          </label>
          <input
            id="board-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards"
            className="field h-9 py-0 w-40"
          />
          <label className="sr-only" htmlFor="board-assignee">
            Show cards for
          </label>
          <select id="board-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} className="field h-9 py-0 w-auto">
            <option value="all">Everyone</option>
            {currentUserId && <option value="me">Only mine</option>}
            <option value="unassigned">Unassigned</option>
            {project.members
              .filter((m) => m.userId !== currentUserId)
              .map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
          </select>
          {project.milestones.length > 0 && (
            <>
              <label className="sr-only" htmlFor="board-milestone">
                Milestone
              </label>
              <select
                id="board-milestone"
                value={milestone}
                onChange={(e) => setMilestone(e.target.value)}
                className="field h-9 py-0 w-auto max-w-[12rem]"
              >
                <option value="all">All milestones</option>
                {project.milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
                <option value="none">No milestone</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* relative: screen-reader labels inside cards are absolutely positioned and must stay inside the scroll area */}
      <div className="relative mt-4 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto pb-2">
        <div className="grid grid-flow-col auto-cols-[minmax(15rem,1fr)] gap-3 min-w-max lg:min-w-0">
          {BOARD_COLUMNS.map((col) => {
            const cards = visible.filter((t) => t.column === col.id).sort(byBoardOrder);
            const total = project.tasks.filter((t) => t.column === col.id).length;
            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOver !== col.id) setDragOver(col.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const id = e.dataTransfer.getData('text/plain');
                  const task = project.tasks.find((t) => t.id === id);
                  if (task && task.column !== col.id) onMove(id, col.id);
                }}
                className={`rounded-2xl border p-2.5 flex flex-col gap-2 min-h-48 transition-colors ${
                  dragOver === col.id ? 'bg-accent-soft border-accent' : 'bg-sunken border-transparent'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2 px-1.5 pt-1">
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                  <span className="text-xs text-ink-3 tabular-nums" aria-label={`${total} cards`}>
                    {filtering && cards.length !== total ? `${cards.length}/${total}` : total}
                  </span>
                </div>
                <ul className="flex flex-col gap-2" aria-label={`${col.label} cards`}>
                  {cards.map((t) => (
                    <TaskCard key={t.id} task={t} project={project} now={now} onOpen={onOpen} />
                  ))}
                </ul>
                {cards.length === 0 && !filtering && (
                  <p className="px-1.5 text-xs text-ink-3">{col.hint}. Drop cards here.</p>
                )}
                <div className="mt-auto">
                  <QuickAdd column={col.id} onAdd={onAdd} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
