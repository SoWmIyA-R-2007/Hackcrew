import React, { useState } from 'react';
import { TaskView, OperativeView } from '@/lib/types';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { getInitials, toDateTimeLocal } from '@/lib/utils';

export interface TaskDraft {
  title: string;
  weight: number;
  assigneeId: string | null;
  dueDate: string | null;
}

interface TaskChecklistProps {
  tasks: TaskView[];
  operatives: OperativeView[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (draft: TaskDraft) => void;
  onUpdateTask: (taskId: string, changes: Pick<TaskDraft, 'assigneeId' | 'dueDate'>) => void;
  onDeleteTask: (taskId: string) => void;
}

const WEIGHT_LABEL: Record<number, string> = { 1: 'Small', 2: 'Medium', 3: 'Large' };

/** Weight shown as 1–3 filled pips */
const WeightPips: React.FC<{ weight: number }> = ({ weight }) => (
  <span className="hidden sm:flex gap-0.5" title={`${WEIGHT_LABEL[weight] ?? weight} task`} aria-label={`Weight ${weight}`}>
    {[1, 2, 3].map((n) => (
      <span key={n} className={`w-1.5 h-3 rounded-sm ${n <= weight ? 'bg-ink-2' : 'bg-rule'}`} />
    ))}
  </span>
);

function DueChip({ task, now }: { task: TaskView; now: number }) {
  if (!task.dueDate) return null;
  const due = new Date(task.dueDate);
  const overdue = !task.completed && due.getTime() < now;
  return (
    <span
      className={`text-xs tabular-nums px-1.5 py-0.5 rounded-md shrink-0 ${
        overdue ? 'bg-danger-soft text-danger font-medium' : 'bg-sunken text-ink-2'
      }`}
      title={`Due ${due.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`}
    >
      {overdue ? 'Overdue ' : 'Due '}
      {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
    </span>
  );
}

function AssigneeSelect({
  id,
  value,
  operatives,
  onChange,
}: {
  id: string;
  value: string;
  operatives: OperativeView[];
  onChange: (value: string) => void;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="field w-auto flex-1 sm:flex-none sm:max-w-44">
      <option value="">Unassigned</option>
      {operatives.map((op) => (
        <option key={op.id} value={op.id}>
          {op.name}
        </option>
      ))}
    </select>
  );
}

export const TaskChecklist: React.FC<TaskChecklistProps> = ({
  tasks,
  operatives,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newWeight, setNewWeight] = useState(1);
  const [newAssignee, setNewAssignee] = useState('');
  const [newDue, setNewDue] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  // Captured once per mount so renders stay pure
  const [now] = useState(() => Date.now());
  const [editAssignee, setEditAssignee] = useState('');
  const [editDue, setEditDue] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddTask({
      title: newTitle.trim(),
      weight: newWeight,
      assigneeId: newAssignee || null,
      dueDate: newDue ? new Date(newDue).toISOString() : null,
    });
    setNewTitle('');
    setNewWeight(1);
    setNewDue('');
  };

  const startEdit = (task: TaskView) => {
    setEditingId(task.id);
    setEditAssignee(task.assigneeId ?? '');
    setEditDue(toDateTimeLocal(task.dueDate ?? null));
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    onUpdateTask(editingId, {
      assigneeId: editAssignee || null,
      dueDate: editDue ? new Date(editDue).toISOString() : null,
    });
    setEditingId(null);
  };

  const assigneeOf = (task: TaskView) => operatives.find((o) => o.id === task.assigneeId);

  return (
    <div>
      {tasks.length === 0 ? (
        <p className="px-5 py-8 text-sm text-ink-2 text-center">
          No tasks yet. Break the build into a few pieces below so progress can be tracked.
        </p>
      ) : (
        <ul className="divide-y divide-rule">
          {tasks.map((task) => {
            const assignee = assigneeOf(task);
            return (
              <li key={task.id} className="group px-5 py-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => onToggleTask(task.id)}
                      className="peer sr-only"
                    />
                    <span
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface ${
                        task.completed ? 'bg-ok border-ok text-white' : 'border-rule-strong bg-surface'
                      }`}
                      aria-hidden="true"
                    >
                      {task.completed && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm ${task.completed ? 'line-through text-ink-3' : 'text-ink'}`}>
                        {task.title}
                      </span>
                      {/* On phones the due date sits under the title to leave room for it */}
                      <span className="sm:hidden block mt-1">
                        <DueChip task={task} now={now} />
                      </span>
                    </span>
                  </label>

                  <span className="hidden sm:inline-flex">
                    <DueChip task={task} now={now} />
                  </span>
                  <WeightPips weight={task.weight} />
                  <span
                    className={`w-7 h-7 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0 ${
                      assignee ? 'bg-sunken text-ink-2' : 'border border-dashed border-rule-strong text-ink-3'
                    }`}
                    title={assignee ? `Assigned to ${assignee.name}` : 'Unassigned'}
                  >
                    {assignee ? getInitials(assignee.name) : '?'}
                  </span>
                  <button
                    onClick={() => (editingId === task.id ? setEditingId(null) : startEdit(task))}
                    className="icon-btn w-8 h-8 sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Change assignee or due date: ${task.title}`}
                    aria-expanded={editingId === task.id}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteTask(task.id)}
                    className="icon-btn w-8 h-8 sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-danger"
                    aria-label={`Delete task: ${task.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {editingId === task.id && (
                  <form onSubmit={saveEdit} className="mt-3 ml-8 flex flex-wrap items-end gap-2">
                    <div>
                      <label htmlFor={`edit-assignee-${task.id}`} className="field-label">
                        Assigned to
                      </label>
                      <AssigneeSelect
                        id={`edit-assignee-${task.id}`}
                        value={editAssignee}
                        operatives={operatives}
                        onChange={setEditAssignee}
                      />
                    </div>
                    <div>
                      <label htmlFor={`edit-due-${task.id}`} className="field-label">
                        Due
                      </label>
                      <input
                        id={`edit-due-${task.id}`}
                        type="datetime-local"
                        value={editDue}
                        onChange={(e) => setEditDue(e.target.value)}
                        className="field w-auto tabular-nums"
                      />
                    </div>
                    <button type="submit" className="btn btn-primary">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="btn btn-ghost">
                      Cancel
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleCreate} className="px-5 py-4 border-t border-rule bg-sunken/50 rounded-b-2xl space-y-2">
        <label htmlFor="new-task" className="sr-only">
          New task
        </label>
        <input
          id="new-task"
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task, e.g. Record the demo video"
          className="field"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="new-task-weight">
            Size
          </label>
          <select
            id="new-task-weight"
            value={newWeight}
            onChange={(e) => setNewWeight(Number(e.target.value))}
            className="field w-auto flex-1 sm:flex-none"
          >
            <option value={1}>Small</option>
            <option value={2}>Medium</option>
            <option value={3}>Large</option>
          </select>
          <label className="sr-only" htmlFor="new-task-assignee">
            Assignee
          </label>
          <AssigneeSelect id="new-task-assignee" value={newAssignee} operatives={operatives} onChange={setNewAssignee} />
          <label className="sr-only" htmlFor="new-task-due">
            Due date
          </label>
          <input
            id="new-task-due"
            type="datetime-local"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            className="field w-auto flex-1 sm:flex-none tabular-nums"
            title="Due date (optional)"
          />
          <button type="submit" className="btn btn-primary ml-auto" disabled={!newTitle.trim()}>
            <Plus className="w-4 h-4" />
            Add task
          </button>
        </div>
      </form>
    </div>
  );
};
