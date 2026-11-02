import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Check } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { InlineError } from '@/components/ErrorScreen';
import { PageSkeleton } from '@/components/Loading';
import { ToastContainer } from '@/components/ToastContainer';
import { api } from '@/lib/api';
import { MyProjectTask, MyTask, ToastMessage } from '@/lib/types';
import { COLUMN_LABEL } from '@/lib/project';
import { generateId } from '@/lib/utils';

const DAY = 24 * 60 * 60 * 1000;

type Group = 'Overdue' | 'Due this week' | 'Later' | 'No due date';

/** A hackathon task or a project card, shown the same way */
interface Item {
  key: string;
  title: string;
  dueDate: string | null;
  completed: boolean;
  source: 'hackathon' | 'project';
  sourceId: string;
  sourceTitle: string;
  taskId: string;
  // Project cards only: the column the card is in
  column?: MyProjectTask['column'];
}

const fromHackathon = (t: MyTask): Item => ({
  key: `h-${t.hackathonId}-${t.id}`,
  title: t.title,
  dueDate: t.dueDate ?? null,
  completed: t.completed,
  source: 'hackathon',
  sourceId: t.hackathonId,
  sourceTitle: t.hackathonTitle,
  taskId: t.id,
});

const fromProject = (t: MyProjectTask): Item => ({
  key: `p-${t.projectId}-${t.id}`,
  title: t.title,
  dueDate: t.dueDate,
  completed: t.column === 'done',
  source: 'project',
  sourceId: t.projectId,
  sourceTitle: t.projectTitle,
  taskId: t.id,
  column: t.column,
});

type SourceFilter = 'all' | Item['source'];

function groupOf(task: Item, now: number): Group {
  if (!task.dueDate) return 'No due date';
  const due = new Date(task.dueDate).getTime();
  if (due < now) return 'Overdue';
  return due - now <= 7 * DAY ? 'Due this week' : 'Later';
}

const byDue = (a: Item, b: Item) =>
  (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);

export default function TasksPage() {
  const [tasks, setTasks] = useState<Item[] | null>(null);
  const [source, setSource] = useState<SourceFilter>('all');
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showDone, setShowDone] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  // Captured once per mount so renders stay pure
  const [now] = useState(() => Date.now());

  useEffect(() => {
    Promise.all([api.myTasks(), api.myProjectTasks()])
      .then(([hackathonTasks, projectTasks]) => setTasks([...hackathonTasks.map(fromHackathon), ...projectTasks.map(fromProject)]))
      .catch(setError);
  }, [reloadKey]);

  const toggle = async (task: Item) => {
    // Ticking a project card moves it to Done; unticking sends it back to To do
    const flip = (completed: boolean) =>
      setTasks(
        (prev) =>
          prev?.map((t) =>
            t.key === task.key
              ? { ...t, completed, ...(t.source === 'project' ? { column: completed ? 'done' : task.completed ? 'todo' : task.column } : {}) }
              : t
          ) ?? null
      );
    flip(!task.completed);
    try {
      if (task.source === 'hackathon') await api.setTaskDone(task.sourceId, task.taskId, !task.completed);
      else await api.updateProjectTask(task.sourceId, task.taskId, { column: task.completed ? 'todo' : 'done' });
      window.dispatchEvent(new Event('hackathons-changed'));
    } catch (err) {
      flip(task.completed);
      const id = `toast-${generateId()}`;
      setToasts((prev) => [
        ...prev,
        { id, type: 'alert', title: 'Could not update the task', message: err instanceof Error ? err.message : 'Try again.' },
      ]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
    }
  };

  const all = tasks ?? [];
  const inSource = all.filter((t) => source === 'all' || t.source === source);
  const open = inSource.filter((t) => !t.completed);
  const done = inSource.filter((t) => t.completed);
  const groups = (['Overdue', 'Due this week', 'Later', 'No due date'] as Group[])
    .map((label) => ({ label, items: open.filter((t) => groupOf(t, now) === label).sort(byDue) }))
    .filter((g) => g.items.length > 0);

  const renderTask = (task: Item) => {
    const overdue = !task.completed && task.dueDate && new Date(task.dueDate).getTime() < now;
    return (
      <li key={task.key} className="flex items-center gap-3 px-5 py-3">
        <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
          <input type="checkbox" checked={task.completed} onChange={() => toggle(task)} className="peer sr-only" />
          <span
            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface ${
              task.completed ? 'bg-ok border-ok text-white' : 'border-rule-strong bg-surface'
            }`}
            aria-hidden="true"
          >
            {task.completed && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
          </span>
          <span className="min-w-0">
            <span className={`block text-sm ${task.completed ? 'line-through text-ink-3' : 'text-ink'}`}>{task.title}</span>
            <Link
              to={task.source === 'hackathon' ? `/dashboard/hackathons/${task.sourceId}` : `/projects/${task.sourceId}`}
              className="block text-xs text-ink-3 hover:text-accent truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {task.source === 'project' ? 'Project: ' : ''}
              {task.sourceTitle}
              {task.column && task.column !== 'done' && task.column !== 'todo' && ` · ${COLUMN_LABEL[task.column]}`}
            </Link>
          </span>
        </label>
        {task.dueDate && (
          <span
            className={`text-xs tabular-nums px-1.5 py-0.5 rounded-md shrink-0 ${
              overdue ? 'bg-danger-soft text-danger font-medium' : 'bg-sunken text-ink-2'
            }`}
          >
            {/* Project cards are due on a day, hackathon tasks at a time */}
            {new Date(task.dueDate).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              ...(task.source === 'hackathon' ? { hour: 'numeric', minute: '2-digit' } : {}),
            })}
          </span>
        )}
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">My tasks</h1>
        <p className="mt-2 text-ink-2">
          Tasks assigned to you across every hackathon and project you are on.
          {tasks && ` ${open.length} open${done.length ? `, ${done.length} done` : ''}.`}
        </p>

        {all.some((t) => t.source === 'project') && all.some((t) => t.source === 'hackathon') && (
          <div className="mt-5 flex gap-1" role="tablist" aria-label="Show tasks from">
            {(
              [
                ['all', 'Everything'],
                ['hackathon', 'Hackathons'],
                ['project', 'Projects'],
              ] as [SourceFilter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={source === id}
                onClick={() => setSource(id)}
                className={`px-3 h-8 rounded-lg text-sm whitespace-nowrap transition-colors cursor-pointer ${
                  source === id ? 'bg-ink text-paper font-medium' : 'text-ink-2 hover:bg-sunken hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {error !== null && (
          <div className="mt-6">
            <InlineError
              error={error}
              what="your tasks"
              onRetry={() => {
                setError(null);
                setReloadKey((k) => k + 1);
              }}
            />
          </div>
        )}
        {!tasks && error === null && (
          <div className="mt-8">
            <PageSkeleton layout="list" label="Loading your tasks" />
          </div>
        )}

        {tasks && open.length === 0 && (
          <div className="mt-8 border border-dashed border-rule-strong rounded-2xl px-6 py-12 text-center">
            <p className="font-display text-xl font-semibold">{inSource.length ? 'All done' : 'Nothing assigned to you yet'}</p>
            <p className="mt-1 text-sm text-ink-2 max-w-md mx-auto">
              {inSource.length
                ? 'Every task assigned to you is ticked off.'
                : 'Open a hackathon or project and assign tasks to yourself, or ask a teammate to. Tasks show up here once they are assigned to you.'}
            </p>
          </div>
        )}

        <div className="mt-8 space-y-6">
          {groups.map((g) => (
            <section key={g.label} aria-labelledby={`group-${g.label}`}>
              <h2
                id={`group-${g.label}`}
                className={`text-sm font-medium mb-2 ${g.label === 'Overdue' ? 'text-danger' : 'text-ink-3'}`}
              >
                {g.label} ({g.items.length})
              </h2>
              <ul className="bg-surface border border-rule rounded-2xl divide-y divide-rule">{g.items.map(renderTask)}</ul>
            </section>
          ))}

          {done.length > 0 && (
            <section>
              <button onClick={() => setShowDone((v) => !v)} className="btn btn-ghost text-sm -ml-2" aria-expanded={showDone}>
                {showDone ? 'Hide' : 'Show'} completed ({done.length})
              </button>
              {showDone && (
                <ul className="mt-2 bg-surface border border-rule rounded-2xl divide-y divide-rule">{done.map(renderTask)}</ul>
              )}
            </section>
          )}
        </div>
      </main>
      <ToastContainer toasts={toasts} onRemoveToast={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
