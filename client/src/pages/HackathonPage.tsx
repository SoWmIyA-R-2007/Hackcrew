import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, LogOut, Pencil, Trash2, Users } from 'lucide-react';
import { HackathonView, PersonSummary, TaskView, ToastMessage, HackathonStatus } from '@/lib/types';
import { api, ApiError, conflictCopy, type CurrentUser } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import { TaskChecklist, type TaskDraft } from '@/components/TaskChecklist';
import { HackathonFormModal } from '@/components/HackathonFormModal';
import { ToastContainer } from '@/components/ToastContainer';
import { SubmissionChecklist } from '@/components/hackathon/SubmissionChecklist';
import { submissionReadiness } from '@/lib/hackathon';
import { ResultPanel } from '@/components/hackathon/ResultPanel';
import { DetailsPanel } from '@/components/hackathon/DetailsPanel';
import { TeamPanel } from '@/components/hackathon/TeamPanel';
import { RemindersPanel } from '@/components/hackathon/RemindersPanel';
import { ProjectPanel } from '@/components/hackathon/ProjectPanel';
import { STATUS_META, describeDeadline, formatDate, generateId, isOverdue } from '@/lib/utils';
import { ErrorScreen } from '@/components/ErrorScreen';
import { PageSkeleton } from '@/components/Loading';

const MODE_LABEL: Record<string, string> = { online: 'online', offline: 'in person', hybrid: 'hybrid' };

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Please try again.');

// Lets the header refresh notifications after deadlines or tasks change
const announceChange = () => window.dispatchEvent(new Event('hackathons-changed'));

export default function HackathonDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const hackathonId = params.id ?? '';

  const [hackathon, setHackathon] = useState<HackathonView | null>(null);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  // Captured once per mount so renders stay pure
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!hackathonId) return;
    let cancelled = false;
    api
      .getHackathon(hackathonId)
      .then((h) => !cancelled && setHackathon(h))
      .catch((err) => {
        // A 404 shows the "not found" screen; anything else is a load failure
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
  }, [hackathonId, reloadKey]);

  const addToast = (title: string, message: string, type: ToastMessage['type'] = 'success') => {
    const id = `toast-${generateId()}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  };

  /**
   * Shows a change straight away and saves it. If a teammate saved first, their version is loaded instead
   * and the change is not applied, so nobody's work is overwritten.
   */
  const save = async (changes: Partial<HackathonView>, successToast?: [string, string]) => {
    if (!hackathon) return false;
    const previous = hackathon;
    setHackathon({ ...hackathon, ...changes });
    try {
      const saved = await api.updateHackathon({ ...hackathon, ...changes });
      setHackathon(saved);
      announceChange();
      if (successToast) addToast(...successToast);
      return true;
    } catch (err) {
      const latest = conflictCopy(err);
      setHackathon(latest ?? previous);
      addToast(latest ? 'Not saved: a teammate changed it' : 'Could not save', errorMessage(err), 'alert');
      return false;
    }
  };

  const handleToggleTask = async (taskId: string) => {
    if (!hackathon) return;
    const task = hackathon.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const previous = hackathon;
    setHackathon({
      ...hackathon,
      tasks: hackathon.tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t)),
    });
    try {
      setHackathon(await api.setTaskDone(hackathon.id, taskId, !task.completed));
      announceChange();
    } catch (err) {
      setHackathon(previous);
      addToast('Could not update the task', errorMessage(err), 'alert');
    }
  };

  const assigneeFields = (assigneeId: string | null) => {
    const op = hackathon?.operatives.find((o) => o.id === assigneeId);
    return { assigneeId: op ? op.id : null, assigneeName: op?.name ?? 'Unassigned', assigneeAvatar: op?.avatar ?? '' };
  };

  const handleAddTask = (draft: TaskDraft) => {
    if (!hackathon) return;
    const task: TaskView = {
      id: `t-${generateId()}`,
      title: draft.title,
      completed: false,
      weight: draft.weight,
      dueDate: draft.dueDate,
      ...assigneeFields(draft.assigneeId),
    };
    save({ tasks: [...hackathon.tasks, task] }, [
      'Task added',
      task.assigneeId ? `"${task.title}" is assigned to ${task.assigneeName}.` : `"${task.title}" was added.`,
    ]);
  };

  const handleUpdateTask = (taskId: string, changes: Pick<TaskDraft, 'assigneeId' | 'dueDate'>) => {
    if (!hackathon) return;
    save(
      {
        tasks: hackathon.tasks.map((t) =>
          t.id === taskId ? { ...t, dueDate: changes.dueDate, ...assigneeFields(changes.assigneeId) } : t
        ),
      },
      ['Task updated', 'The assignee and due date were saved.']
    );
  };

  const handleDeleteTask = (taskId: string) => {
    if (!hackathon) return;
    save({ tasks: hackathon.tasks.filter((t) => t.id !== taskId) }, ['Task deleted', 'Progress has been recalculated.']);
  };

  const handleStatusChange = (status: HackathonStatus) => {
    if (!hackathon || hackathon.status === status) return;
    const missing = submissionReadiness(hackathon.submission);
    save({ status }, [
      'Status changed',
      status === 'submitted' && !missing.ready
        ? `Marked as submitted. ${missing.total - missing.done} submission links are still empty.`
        : `Marked as ${STATUS_META[status].label.toLowerCase()}.`,
    ]);
  };

  const handleInvite = async (email: string, role: string) => {
    if (!hackathon) return false;
    try {
      const { hackathon: updated, emailed } = await api.inviteTeammate(hackathon.id, email, role);
      setHackathon(updated);
      addToast(
        'Teammate added',
        emailed ? `An invite email was sent to ${email}.` : `${email} was added to the team list. No email was sent.`
      );
      return true;
    } catch (err) {
      addToast('Could not add teammate', errorMessage(err), 'alert');
      return false;
    }
  };

  const handleInviteFriend = async (friend: PersonSummary, role: string) => {
    if (!hackathon) return false;
    try {
      const { hackathon: updated } = await api.inviteFriend(hackathon.id, friend.userId, role);
      setHackathon(updated);
      addToast('Invite sent', `${friend.name} (@${friend.username}) was invited as ${role}. They can join from their Friends page.`);
      return true;
    } catch (err) {
      addToast('Could not invite', errorMessage(err), 'alert');
      return false;
    }
  };

  const handleInviteByUsername = async (username: string, role: string) => {
    if (!hackathon) return false;
    try {
      const { hackathon: updated, awaitingFriend } = await api.inviteByUsername(hackathon.id, username, role);
      setHackathon(updated);
      addToast(
        awaitingFriend ? 'Friend request sent' : 'Invite sent',
        awaitingFriend
          ? `@${username} is not your friend yet. They get the team invite as soon as they accept your friend request.`
          : `@${username} was invited as ${role}. They can join from their Friends page.`
      );
      return true;
    } catch (err) {
      addToast('Could not invite', errorMessage(err), 'alert');
      return false;
    }
  };

  const handleRemove = async (operativeId: string) => {
    if (!hackathon) return;
    const op = hackathon.operatives.find((o) => o.id === operativeId);
    if (!op) return;
    const leaving = Boolean(me && op.userId === me.id);
    const question = leaving
      ? `Leave team ${hackathon.teamName}? You will lose access to ${hackathon.title}.`
      : `Remove ${op.name} from ${hackathon.teamName}?${op.userId ? ' They will lose access to this hackathon.' : ''}`;
    if (!confirm(question)) return;
    try {
      const result = await api.removeTeammate(hackathon.id, operativeId);
      if (result.left) {
        announceChange();
        navigate('/dashboard');
        return;
      }
      if (result.hackathon) setHackathon(result.hackathon);
      addToast('Teammate removed', `${op.name} is no longer on ${hackathon.teamName}.`, 'info');
    } catch (err) {
      addToast('Could not remove teammate', errorMessage(err), 'alert');
    }
  };

  const handleEmailTeam = async (note: string) => {
    if (!hackathon) return false;
    try {
      const { sent } = await api.emailTeam(hackathon.id, note);
      addToast('Update sent', `Emailed ${sent} ${sent === 1 ? 'person' : 'people'} on the team.`);
      return true;
    } catch (err) {
      addToast('Could not email the team', errorMessage(err), 'alert');
      return false;
    }
  };

  const handleDeleteHackathon = async () => {
    if (!hackathon) return;
    if (!confirm(`Delete "${hackathon.title}"? Its tasks and team list are removed for everyone on the team.`)) return;
    try {
      await api.deleteHackathon(hackathon.id);
      announceChange();
      navigate('/dashboard');
    } catch (err) {
      addToast('Could not delete', errorMessage(err), 'alert');
    }
  };

  const handleLeave = () => {
    const mine = hackathon?.operatives.find((o) => me && o.userId === me.id);
    if (mine) handleRemove(mine.id);
  };

  const retry = () => {
    setLoadError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <PageSkeleton layout="detail" label="Loading hackathon" />
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />
        <ErrorScreen variant="inline" error={loadError} onRetry={retry} home={{ to: '/dashboard', label: 'Back to all hackathons' }} />
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />
        <ErrorScreen
          variant="inline"
          kind="not-found"
          title="Hackathon not found"
          message="It may have been deleted, the link may be wrong, or you are no longer on its team."
          home={{ to: '/dashboard', label: 'Back to all hackathons' }}
        />
      </div>
    );
  }

  const meta = STATUS_META[hackathon.status];
  const overdue = isOverdue(hackathon);
  const finished = hackathon.status === 'submitted' || hackathon.status === 'completed';
  const doneCount = hackathon.tasks.filter((t) => t.completed).length;
  const isOwner = hackathon.role !== 'member';
  const canEmail = Boolean(me && !me.isDemo);

  // Share of the kickoff → deadline window that has already passed
  const start = new Date(hackathon.kickoffDate).getTime();
  const end = hackathon.submissionDeadline ? new Date(hackathon.submissionDeadline).getTime() : null;
  const elapsed =
    end && end > start ? Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100))) : null;
  const behind = elapsed !== null && !finished && hackathon.completion + 10 < elapsed;

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-accent rounded">
          <ArrowLeft className="w-4 h-4" />
          All hackathons
        </Link>

        {/* Title and actions */}
        <div className="mt-4 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="min-w-0 max-w-3xl">
            {!isOwner && (
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-accent bg-accent-soft rounded-md px-2 py-1 mb-2">
                <Users className="w-3.5 h-3.5" />
                Shared with you
              </p>
            )}
            <h1 className="font-display text-3xl sm:text-[2.75rem] sm:leading-[1.1] font-semibold tracking-tight">
              {hackathon.title}
            </h1>
            <p className="mt-2 text-ink-2">
              Team {hackathon.teamName}, {hackathon.domain} track, {MODE_LABEL[hackathon.mode ?? 'online']}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="sr-only" htmlFor="status-select">
              Status
            </label>
            <select
              id="status-select"
              value={hackathon.status}
              onChange={(e) => handleStatusChange(e.target.value as HackathonStatus)}
              className={`h-9 rounded-lg pl-3 pr-8 text-sm font-medium border-0 cursor-pointer ${meta.badge}`}
            >
              {(Object.keys(STATUS_META) as HackathonStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
            <button onClick={() => setIsEditOpen(true)} className="btn btn-secondary">
              <Pencil className="w-4 h-4" />
              Edit details
            </button>
            {isOwner ? (
              <button onClick={handleDeleteHackathon} className="btn btn-danger" aria-label="Delete hackathon">
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            ) : (
              <button onClick={handleLeave} className="btn btn-danger">
                <LogOut className="w-4 h-4" />
                Leave team
              </button>
            )}
          </div>
        </div>

        {/* Time used vs work done */}
        <section
          aria-label="Progress against the deadline"
          className="mt-8 bg-surface border border-rule rounded-2xl px-5 py-5 grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-center"
        >
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-ink-2">Time used</span>
              <span className="tabular-nums font-medium">{elapsed === null ? 'No deadline' : `${elapsed}%`}</span>
            </div>
            <div className="h-2 bg-sunken rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${overdue ? 'bg-danger' : 'bg-ink-2'}`}
                style={{ width: `${elapsed ?? 0}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-ink-2">
                Tasks done ({doneCount} of {hackathon.tasks.length})
              </span>
              <span className="tabular-nums font-medium">{hackathon.completion}%</span>
            </div>
            <div className="h-2 bg-sunken rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${hackathon.completion}%` }} />
            </div>
          </div>
          <div className="md:text-right md:pl-5 md:border-l md:border-rule">
            <p className="tabular-nums font-medium">{formatDate(hackathon.submissionDeadline)}</p>
            <p className={`text-sm ${overdue || behind ? 'text-danger font-medium' : 'text-ink-3'}`}>
              {finished ? meta.label : behind && !overdue ? 'Tasks are behind the clock' : describeDeadline(hackathon.submissionDeadline)}
            </p>
          </div>
        </section>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
          <div className="space-y-6 min-w-0">
            <section aria-labelledby="ps-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <h2 id="ps-heading" className="font-display text-lg font-semibold">
                  Problem statement
                </h2>
                {hackathon.psId && (
                  <span className="text-xs font-medium text-ink-2 bg-sunken rounded-md px-2 py-1">{hackathon.psId}</span>
                )}
              </div>
              <p className="mt-3 text-ink leading-relaxed max-w-prose whitespace-pre-line">{hackathon.problemStatement}</p>
            </section>

            <section aria-labelledby="tasks-heading" className="bg-surface border border-rule rounded-2xl">
              <div className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3 border-b border-rule">
                <h2 id="tasks-heading" className="font-display text-lg font-semibold">
                  Tasks
                </h2>
                <span className="text-sm text-ink-3">Progress is weighted by task size</span>
              </div>
              <TaskChecklist
                tasks={hackathon.tasks}
                operatives={hackathon.operatives}
                onToggleTask={handleToggleTask}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
              />
            </section>

            <SubmissionChecklist
              key={`sub-${hackathon.version}`}
              links={hackathon.submission}
              onSave={(submission) => save({ submission }, ['Links saved', 'The submission checklist was updated.'])}
            />

            <ResultPanel
              key={`result-${hackathon.version}`}
              result={hackathon.result}
              onSave={(result) => save({ result }, ['Result saved', 'It now counts in your stats.'])}
            />
          </div>

          <aside className="space-y-6">
            <DetailsPanel hackathon={hackathon} />
            <ProjectPanel hackathon={hackathon} onToast={addToast} />
            <TeamPanel
              hackathon={hackathon}
              currentUserId={me?.id ?? null}
              canEmail={canEmail}
              onInvite={handleInvite}
              onInviteFriend={handleInviteFriend}
              onInviteByUsername={handleInviteByUsername}
              onRemove={handleRemove}
            />
            <RemindersPanel
              reminders={hackathon.reminders}
              hasDeadline={Boolean(hackathon.submissionDeadline)}
              canEmail={canEmail}
              onSave={(reminders) => save({ reminders })}
              onEmailTeam={handleEmailTeam}
            />
          </aside>
        </div>
      </main>

      <HackathonFormModal
        isOpen={isEditOpen}
        hackathon={hackathon}
        onClose={() => setIsEditOpen(false)}
        onSubmit={(updated) => save(updated, ['Changes saved', `${updated.title} has been updated.`])}
      />

      <ToastContainer toasts={toasts} onRemoveToast={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
