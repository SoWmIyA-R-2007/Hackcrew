import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertTriangle, Flag, Plus, Trophy, User } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { InlineError } from '@/components/ErrorScreen';
import { PageSkeleton } from '@/components/Loading';
import { ToastContainer } from '@/components/ToastContainer';
import { ProjectFormModal } from '@/components/project/ProjectFormModal';
import { api } from '@/lib/api';
import { ProjectStatus, ProjectSummary, ToastMessage } from '@/lib/types';
import { PROJECT_STATUS_META, dueLabel } from '@/lib/project';
import { generateId, getInitials } from '@/lib/utils';

type Filter = 'active' | ProjectStatus | 'all';

const FILTERS: { id: Filter; label: string; test: (p: ProjectSummary) => boolean }[] = [
  { id: 'active', label: 'Active', test: (p) => p.status === 'idea' || p.status === 'building' || p.status === 'paused' },
  { id: 'building', label: 'Building', test: (p) => p.status === 'building' },
  { id: 'idea', label: 'Ideas', test: (p) => p.status === 'idea' },
  { id: 'shipped', label: 'Shipped', test: (p) => p.status === 'shipped' },
  { id: 'archived', label: 'Archived', test: (p) => p.status === 'archived' },
  { id: 'all', label: 'All', test: () => true },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function ProjectCard({ project, now }: { project: ProjectSummary; now: number }) {
  const meta = PROJECT_STATUS_META[project.status];
  const { counts } = project;
  return (
    <li>
      <Link
        to={`/projects/${project.id}`}
        className="group block h-full bg-surface border border-rule rounded-2xl px-5 py-5 hover:border-rule-strong transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold leading-snug group-hover:text-accent transition-colors">
              {project.title}
            </h2>
            {project.tagline && <p className="mt-0.5 text-sm text-ink-2 line-clamp-2">{project.tagline}</p>}
          </div>
          <span className={`shrink-0 text-xs font-medium rounded-md px-2 py-1 ${meta.badge}`}>{meta.label}</span>
        </div>

        {project.hackathon && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-2 bg-sunken rounded-md px-2 py-1 max-w-full">
            <Trophy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{project.hackathon.title}</span>
          </p>
        )}

        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-ink-2">
              {counts.total ? `${counts.done} of ${plural(counts.total, 'card')} done` : 'No cards yet'}
            </span>
            <span className="tabular-nums font-medium">{project.progress}%</span>
          </div>
          <div className="h-1.5 bg-sunken rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${project.progress}%` }} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
          {counts.overdue > 0 && (
            <span className="inline-flex items-center gap-1 text-danger font-medium">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
              {counts.overdue} overdue
            </span>
          )}
          {counts.mine > 0 && (
            <span className="inline-flex items-center gap-1">
              <User className="w-3.5 h-3.5" aria-hidden="true" />
              {counts.mine} on you
            </span>
          )}
          {project.nextMilestone && (
            <span className="inline-flex items-center gap-1 min-w-0">
              <Flag className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {project.nextMilestone.title}
                {project.nextMilestone.dueDate && `, ${dueLabel(project.nextMilestone.dueDate, now).toLowerCase()}`}
              </span>
            </span>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-rule flex items-center justify-between gap-3">
          <div className="flex -space-x-1.5" aria-label={`${plural(project.members.length, 'person')} on the project`}>
            {project.members.slice(0, 5).map((m) => (
              <span
                key={m.userId}
                title={m.name}
                className="w-7 h-7 rounded-full bg-accent-soft text-accent text-[10px] font-semibold flex items-center justify-center ring-2 ring-surface"
              >
                {getInitials(m.name)}
              </span>
            ))}
            {project.members.length > 5 && (
              <span className="w-7 h-7 rounded-full bg-sunken text-ink-2 text-[10px] font-semibold flex items-center justify-center ring-2 ring-surface">
                +{project.members.length - 5}
              </span>
            )}
          </div>
          {project.techStack.length > 0 && (
            <p className="text-xs text-ink-3 truncate min-w-0">{project.techStack.slice(0, 3).join(' · ')}</p>
          )}
        </div>
      </Link>
    </li>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<Filter>('active');
  const [creating, setCreating] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  // Captured once per mount so renders stay pure
  const [now] = useState(() => Date.now());

  useEffect(() => {
    api
      .listProjects()
      .then(setProjects)
      .catch(setError);
  }, [reloadKey]);

  const addToast = (title: string, message: string, type: ToastMessage['type'] = 'success') => {
    const id = `toast-${generateId()}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  };

  const list = projects ?? [];
  const active = FILTERS.find((f) => f.id === filter)!;
  const shown = list.filter(active.test);
  const totals = {
    building: list.filter((p) => p.status === 'building').length,
    shipped: list.filter((p) => p.status === 'shipped').length,
    mine: list.reduce((sum, p) => sum + p.counts.mine, 0),
    overdue: list.reduce((sum, p) => sum + p.counts.overdue, 0),
  };

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Projects</h1>
            <p className="mt-2 text-ink-2 max-w-xl">
              Track what you are building, for a hackathon or on your own: a board of cards, milestones, and who is doing
              what.
            </p>
          </div>
          <button onClick={() => setCreating(true)} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            New project
          </button>
        </div>

        {error !== null && (
          <div className="mt-6">
            <InlineError
              error={error}
              what="your projects"
              onRetry={() => {
                setError(null);
                setReloadKey((k) => k + 1);
              }}
            />
          </div>
        )}
        {!projects && error === null && (
          <div className="mt-8">
            <PageSkeleton layout="cards" label="Loading your projects" />
          </div>
        )}

        {projects && projects.length > 0 && (
          <>
            <dl className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Building now', value: totals.building },
                { label: 'Shipped', value: totals.shipped },
                { label: 'Open cards on you', value: totals.mine },
                { label: 'Overdue cards', value: totals.overdue, alert: totals.overdue > 0 },
              ].map((s) => (
                <div key={s.label} className="bg-surface border border-rule rounded-2xl px-5 py-4">
                  <dt className="text-sm text-ink-2">{s.label}</dt>
                  <dd className={`mt-1 font-display text-3xl font-semibold tabular-nums ${s.alert ? 'text-danger' : ''}`}>
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex gap-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter projects">
              {FILTERS.map((f) => {
                const count = list.filter(f.test).length;
                return (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={`px-3 h-8 rounded-lg text-sm whitespace-nowrap transition-colors cursor-pointer ${
                      filter === f.id ? 'bg-ink text-paper font-medium' : 'text-ink-2 hover:bg-sunken hover:text-ink'
                    }`}
                  >
                    {f.label} <span className="tabular-nums opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>

            {shown.length === 0 ? (
              <p className="mt-6 text-sm text-ink-2">No projects here. Try another filter.</p>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((p) => (
                  <ProjectCard key={p.id} project={p} now={now} />
                ))}
              </ul>
            )}
          </>
        )}

        {projects && projects.length === 0 && (
          <div className="mt-8 border border-dashed border-rule-strong rounded-2xl px-6 py-14 text-center">
            <p className="font-display text-xl font-semibold">Start your first project</p>
            <p className="mt-1 text-sm text-ink-2 max-w-md mx-auto">
              Break the work into cards, move them across the board as you go, and set milestones for the demo and the
              pitch. Link it to a hackathon to bring your team along.
            </p>
            <button onClick={() => setCreating(true)} className="btn btn-primary mt-5">
              <Plus className="w-4 h-4" />
              New project
            </button>
          </div>
        )}
      </main>

      {creating && (
        <ProjectFormModal
          onClose={() => setCreating(false)}
          onSubmit={async (details, { addTeammates }) => {
            try {
              const project = await api.createProject({ ...details, addTeammates });
              navigate(`/projects/${project.id}`);
              return true;
            } catch (err) {
              addToast('Could not create the project', err instanceof Error ? err.message : 'Try again.', 'alert');
              return false;
            }
          }}
        />
      )}
      <ToastContainer toasts={toasts} onRemoveToast={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
