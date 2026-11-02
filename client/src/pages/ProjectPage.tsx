import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, LogOut, Pencil, Trash2, Users } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ToastContainer } from '@/components/ToastContainer';
import { ProjectBoard } from '@/components/project/ProjectBoard';
import { TaskEditor } from '@/components/project/TaskEditor';
import { MilestonesPanel } from '@/components/project/MilestonesPanel';
import { ProjectTeamPanel } from '@/components/project/ProjectTeamPanel';
import { ActivityPanel } from '@/components/project/ActivityPanel';
import { ProjectDetailsPanel } from '@/components/project/ProjectDetailsPanel';
import { ProjectFormModal } from '@/components/project/ProjectFormModal';
import { GitHubPanel } from '@/components/project/GitHubPanel';
import { api, ApiError, type CurrentUser, type ProjectDetails } from '@/lib/api';
import { BoardColumn, ProjectStatus, ProjectView, ToastMessage } from '@/lib/types';
import { BOARD_COLUMNS, COLUMN_LABEL, PROJECT_STATUSES, PROJECT_STATUS_META, isCardOverdue } from '@/lib/project';
import { generateId } from '@/lib/utils';
import { ErrorScreen } from '@/components/ErrorScreen';
import { PageSkeleton } from '@/components/Loading';

const DAY = 24 * 60 * 60 * 1000;
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Please try again.');

// Lets the header refresh notifications after cards or milestones change
const announceChange = () => window.dispatchEvent(new Event('hackathons-changed'));

const COLUMN_BAR: Record<BoardColumn, string> = {
  backlog: 'bg-rule-strong',
  todo: 'bg-ink-3',
  in_progress: 'bg-accent',
  review: 'bg-warn',
  done: 'bg-ok',
};

const detailsOf = (p: ProjectView): ProjectDetails & { id: string } => ({
  id: p.id,
  title: p.title,
  tagline: p.tagline,
  description: p.description,
  status: p.status,
  techStack: p.techStack,
  links: p.links,
  startDate: p.startDate,
  targetDate: p.targetDate,
  hackathonId: p.hackathon?.id ?? null,
});

export default function ProjectPage() {
  const projectId = useParams().id ?? '';
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectView | null>(null);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  // Captured once per mount so renders stay pure
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    api
      .getProject(projectId)
      .then((p) => !cancelled && setProject(p))
      .catch((err) => {
        if (!cancelled && !(err instanceof ApiError && err.status === 404)) setLoadError(err);
      })
      .finally(() => !cancelled && setLoading(false));
    api
      .me()
      .then((u) => !cancelled && setMe(u))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  const addToast = useCallback((title: string, message: string, type: ToastMessage['type'] = 'success') => {
    const id = `toast-${generateId()}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const syncGitHub = useCallback(async () => {
    setSyncing(true);
    try {
      const { project: updated, finished } = await api.syncGitHub(projectId);
      setProject(updated);
      if (finished) {
        announceChange();
        addToast('Cards finished on GitHub', `${finished} ${finished === 1 ? 'card was' : 'cards were'} moved to Done because the pull request was merged.`);
      }
    } catch (err) {
      addToast('Could not refresh from GitHub', errorMessage(err), 'alert');
    } finally {
      setSyncing(false);
    }
  }, [projectId, addToast]);

  // Refresh from GitHub on open when the copy is missing or more than five minutes old
  const githubRepo = project?.github?.repo ?? null;
  const githubSyncedAt = project?.github?.syncedAt ?? null;
  useEffect(() => {
    if (!githubRepo) return;
    if (githubSyncedAt && Date.now() - Date.parse(githubSyncedAt) < 5 * 60 * 1000) return;
    // Deferred so the first paint is not held up by the request
    const timer = setTimeout(syncGitHub, 0);
    return () => clearTimeout(timer);
    // Only when the repository changes, not after every sync
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubRepo]);

  /** Runs a change on the server and shows the project it sends back. A failure keeps the previous copy */
  const run = async (action: () => Promise<ProjectView>, failTitle: string, success?: [string, string]) => {
    try {
      setProject(await action());
      announceChange();
      if (success) addToast(...success);
      return true;
    } catch (err) {
      addToast(failTitle, errorMessage(err), 'alert');
      return false;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <PageSkeleton layout="detail" label="Loading project" />
        </main>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />
        {loadError ? (
          <ErrorScreen
            variant="inline"
            error={loadError}
            onRetry={() => {
              setLoadError(null);
              setLoading(true);
              setReloadKey((k) => k + 1);
            }}
            home={{ to: '/projects', label: 'All projects' }}
          />
        ) : (
          <ErrorScreen
            variant="inline"
            kind="not-found"
            title="Project not found"
            message="It may have been deleted, the link may be wrong, or you are no longer a collaborator."
            home={{ to: '/projects', label: 'All projects' }}
          />
        )}
      </div>
    );
  }

  const id = project.id;
  const isOwner = project.role === 'owner';
  const meta = PROJECT_STATUS_META[project.status];
  const openTask = project.tasks.find((t) => t.id === openTaskId) ?? null;
  const counts = Object.fromEntries(
    BOARD_COLUMNS.map((c) => [c.id, project.tasks.filter((t) => t.column === c.id).length])
  ) as Record<BoardColumn, number>;
  const overdue = project.tasks.filter((t) => isCardOverdue(t, now)).length;
  const doneThisWeek = project.tasks.filter((t) => t.completedAt && now - Date.parse(t.completedAt) <= 7 * DAY).length;
  const mine = me ? project.tasks.filter((t) => t.assigneeId === me.id && t.column !== 'done').length : 0;

  const moveTask = (taskId: string, column: BoardColumn) => {
    const task = project.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const previous = project;
    // Move the card straight away; the server's copy replaces it
    setProject({ ...project, tasks: project.tasks.map((t) => (t.id === taskId ? { ...t, column } : t)) });
    api
      .updateProjectTask(id, taskId, { column })
      .then((p) => {
        setProject(p);
        announceChange();
      })
      .catch((err) => {
        setProject(previous);
        addToast(`Could not move "${task.title}" to ${COLUMN_LABEL[column]}`, errorMessage(err), 'alert');
      });
  };

  const handleStatus = (status: ProjectStatus) =>
    status !== project.status &&
    run(() => api.updateProject(id, { status }), 'Could not change the status', [
      'Status changed',
      status === 'shipped' ? 'Shipped. Nice work. Add it to your public profile from the Profile page.' : `Marked as ${PROJECT_STATUS_META[status].label.toLowerCase()}.`,
    ]);

  const handleDelete = async () => {
    if (!confirm(`Delete "${project.title}"? Its board, milestones and history are removed for everyone on it.`)) return;
    try {
      await api.deleteProject(id);
      announceChange();
      navigate('/projects');
    } catch (err) {
      addToast('Could not delete', errorMessage(err), 'alert');
    }
  };

  const handleRemove = async (userId: string) => {
    const person = project.members.find((m) => m.userId === userId);
    const leaving = userId === me?.id;
    const question = leaving
      ? `Leave "${project.title}"? You will lose access, and your cards become unassigned.`
      : `Remove ${person?.name ?? 'this person'} from "${project.title}"? Their cards become unassigned.`;
    if (!confirm(question)) return;
    try {
      const result = await api.removeCollaborator(id, userId);
      if (result.left) {
        navigate('/projects');
        return;
      }
      if (result.project) setProject(result.project);
      addToast('Removed', `${person?.name ?? 'They'} no longer ${person ? 'has' : 'have'} access to the project.`, 'info');
    } catch (err) {
      addToast('Could not remove', errorMessage(err), 'alert');
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-accent rounded">
          <ArrowLeft className="w-4 h-4" />
          All projects
        </Link>

        <div className="mt-4 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="min-w-0 max-w-3xl">
            {!isOwner && (
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-accent bg-accent-soft rounded-md px-2 py-1 mb-2">
                <Users className="w-3.5 h-3.5" />
                You collaborate on this
              </p>
            )}
            <h1 className="font-display text-3xl sm:text-[2.75rem] sm:leading-[1.1] font-semibold tracking-tight">{project.title}</h1>
            {project.tagline && <p className="mt-2 text-ink-2">{project.tagline}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="sr-only" htmlFor="project-status">
              Status
            </label>
            <select
              id="project-status"
              value={project.status}
              onChange={(e) => handleStatus(e.target.value as ProjectStatus)}
              className={`h-9 rounded-lg pl-3 pr-8 text-sm font-medium border-0 cursor-pointer ${meta.badge}`}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_META[s].label}
                </option>
              ))}
            </select>
            <button onClick={() => setEditing(true)} className="btn btn-secondary">
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            {isOwner ? (
              <button onClick={handleDelete} className="btn btn-danger" aria-label="Delete project">
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            ) : (
              me && (
                <button onClick={() => handleRemove(me.id)} className="btn btn-danger">
                  <LogOut className="w-4 h-4" />
                  Leave
                </button>
              )
            )}
          </div>
        </div>

        {/* Where the work stands */}
        <section
          aria-label="Progress"
          className="mt-8 bg-surface border border-rule rounded-2xl px-5 py-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
        >
          <div className="min-w-0">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-ink-2">
                {project.tasks.length
                  ? `${counts.done} of ${project.tasks.length} ${project.tasks.length === 1 ? 'card' : 'cards'} done`
                  : 'No cards yet. Add some to the board below.'}
              </span>
              <span className="tabular-nums font-medium">{project.progress}%</span>
            </div>
            {/* One bar split by column, so the shape of the work is visible at a glance */}
            <div className="h-2.5 bg-sunken rounded-full overflow-hidden flex" aria-hidden="true">
              {[...BOARD_COLUMNS].reverse().map((c) =>
                counts[c.id] ? (
                  <div key={c.id} className={COLUMN_BAR[c.id]} style={{ width: `${(counts[c.id] / project.tasks.length) * 100}%` }} />
                ) : null
              )}
            </div>
            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
              {[...BOARD_COLUMNS].reverse().map((c) => (
                <li key={c.id} className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${COLUMN_BAR[c.id]}`} aria-hidden="true" />
                  {c.label} <span className="tabular-nums font-medium text-ink">{counts[c.id]}</span>
                </li>
              ))}
            </ul>
          </div>
          <dl className="grid grid-cols-3 gap-4 md:pl-5 md:border-l md:border-rule text-center md:text-left">
            <div>
              <dt className="text-xs text-ink-3">Overdue</dt>
              <dd className={`font-display text-2xl font-semibold tabular-nums ${overdue ? 'text-danger' : ''}`}>{overdue}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Done in 7 days</dt>
              <dd className="font-display text-2xl font-semibold tabular-nums">{doneThisWeek}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Open on you</dt>
              <dd className="font-display text-2xl font-semibold tabular-nums">{mine}</dd>
            </div>
          </dl>
        </section>

        <div className="mt-8">
          <ProjectBoard
            project={project}
            currentUserId={me?.id ?? null}
            now={now}
            onMove={moveTask}
            onOpen={(t) => setOpenTaskId(t.id)}
            onAdd={(column, title) => run(() => api.addProjectTask(id, { title, column }), 'Could not add the card')}
          />
        </div>

        <div className="mt-8">
          <GitHubPanel project={project} now={now} syncing={syncing} onSync={syncGitHub} onEdit={() => setEditing(true)} />
        </div>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
          <div className="space-y-6 min-w-0">
            <MilestonesPanel
              project={project}
              now={now}
              onAdd={(m) => run(() => api.addMilestone(id, m), 'Could not add the milestone')}
              onToggle={(m) =>
                run(
                  () => api.updateMilestone(id, m.id, { done: !m.done }),
                  'Could not update the milestone',
                  m.done ? undefined : ['Milestone reached', `${m.title} is done.`]
                )
              }
              onDelete={(m) => run(() => api.deleteMilestone(id, m.id), 'Could not delete the milestone')}
            />
            <ActivityPanel activity={project.activity} currentUserId={me?.id ?? null} now={now} />
          </div>
          <aside className="space-y-6">
            <ProjectDetailsPanel project={project} now={now} onEdit={() => setEditing(true)} />
            <ProjectTeamPanel
              project={project}
              currentUserId={me?.id ?? null}
              now={now}
              canAdd={Boolean(me && !me.isDemo)}
              onInvite={async (who) => {
                const label = 'name' in who ? who.name : `@${who.username}`;
                try {
                  const { project: updated, awaitingFriend } = await api.inviteCollaborator(
                    id,
                    'userId' in who ? { userId: who.userId } : { username: who.username }
                  );
                  setProject(updated);
                  addToast(
                    awaitingFriend ? 'Friend request sent' : 'Invitation sent',
                    awaitingFriend
                      ? `${label} is not your friend yet. They get the project invitation as soon as they accept your friend request.`
                      : `${label} can join from their Friends page.`
                  );
                  return true;
                } catch (err) {
                  addToast('Could not invite', errorMessage(err), 'alert');
                  return false;
                }
              }}
              onWithdraw={(userId) => run(() => api.withdrawProjectInvite(id, userId), 'Could not withdraw the invitation')}
              onRemove={handleRemove}
            />
          </aside>
        </div>
      </main>

      {openTask && (
        <TaskEditor
          key={openTask.id}
          task={openTask}
          project={project}
          currentUserId={me?.id ?? null}
          now={now}
          onClose={() => setOpenTaskId(null)}
          onSave={(changes) => run(() => api.updateProjectTask(id, openTask.id, changes), 'Could not save the card')}
          onDelete={() => run(() => api.deleteProjectTask(id, openTask.id), 'Could not delete the card')}
        />
      )}
      {editing && (
        <ProjectFormModal
          project={detailsOf(project)}
          onClose={() => setEditing(false)}
          onSubmit={(details) => run(() => api.updateProject(id, details), 'Could not save', ['Saved', 'The project details were updated.'])}
        />
      )}
      <ToastContainer toasts={toasts} onRemoveToast={(tid) => setToasts((prev) => prev.filter((t) => t.id !== tid))} />
    </div>
  );
}
