import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { LogOut, UserMinus, UserPlus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { ProjectCandidate, ProjectView } from '@/lib/types';
import { getInitials } from '@/lib/utils';
import { InviteByUsername } from '@/components/InviteByUsername';
import { Spinner } from '@/components/Loading';

interface Props {
  project: ProjectView;
  currentUserId: string | null;
  now: number;
  // Demo accounts cannot add people
  canAdd: boolean;
  onInvite: (who: { userId: string; name: string } | { username: string }) => Promise<boolean>;
  onWithdraw: (userId: string) => void;
  onRemove: (userId: string) => void;
}

/** Who is on the project, how many open cards each has, who is invited, and (for the owner) people to invite */
export const ProjectTeamPanel: React.FC<Props> = ({ project, currentUserId, now, canAdd, onInvite, onWithdraw, onRemove }) => {
  const isOwner = project.role === 'owner';
  const [candidates, setCandidates] = useState<ProjectCandidate[] | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const memberKey = [...project.members, ...project.invited].map((m) => m.userId).join(',');

  useEffect(() => {
    if (!isOwner || !canAdd) return;
    api
      .projectCandidates(project.id)
      .then(setCandidates)
      .catch(() => setCandidates([]));
  }, [isOwner, canAdd, project.id, project.hackathon?.id, memberKey]);

  const open = (userId: string) => project.tasks.filter((t) => t.assigneeId === userId && t.column !== 'done');
  const unassigned = project.tasks.filter((t) => !t.assigneeId && t.column !== 'done').length;

  const add = async (person: ProjectCandidate) => {
    setAddingId(person.userId);
    await onInvite({ userId: person.userId, name: person.name });
    setAddingId(null);
  };

  return (
    <section aria-labelledby="project-team-heading" className="bg-surface border border-rule rounded-2xl">
      <div className="flex items-baseline justify-between px-5 pt-5 pb-3">
        <h2 id="project-team-heading" className="font-display text-lg font-semibold">
          People
        </h2>
        <span className="text-sm text-ink-3">{project.members.length} on the project</span>
      </div>
      <ul className="divide-y divide-rule border-y border-rule">
        {project.members.map((m) => {
          const cards = open(m.userId);
          const overdue = cards.filter((t) => t.dueDate && Date.parse(t.dueDate) < now).length;
          const isMe = m.userId === currentUserId;
          return (
            <li key={m.userId} className="flex items-center gap-3 px-5 py-3">
              <span className="w-9 h-9 rounded-full bg-accent-soft text-accent text-xs font-semibold flex items-center justify-center shrink-0">
                {getInitials(m.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {m.name}
                  {isMe && <span className="text-ink-3 font-normal"> (you)</span>}
                </p>
                <p className="text-xs text-ink-3 truncate">
                  {m.username && <span className="text-ink-2">@{m.username}, </span>}
                  {m.position === 'owner' ? 'Owner' : 'Collaborator'}
                </p>
              </div>
              <span className={`text-xs tabular-nums shrink-0 ${overdue ? 'text-danger font-medium' : 'text-ink-2'}`}>
                {cards.length} open{overdue ? `, ${overdue} late` : ''}
              </span>
              {m.position !== 'owner' && (isOwner || isMe) && (
                <button
                  onClick={() => onRemove(m.userId)}
                  className="icon-btn w-8 h-8 shrink-0"
                  aria-label={isMe ? 'Leave the project' : `Remove ${m.name}`}
                  title={isMe ? 'Leave the project' : `Remove ${m.name}`}
                >
                  {isMe ? <LogOut className="w-4 h-4" /> : <UserMinus className="w-4 h-4" />}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {project.invited.length > 0 && (
        <div className="px-5 pt-4">
          <h3 className="text-sm font-semibold">Invited</h3>
          <ul className="mt-2 space-y-2">
            {project.invited.map((p) => (
              <li key={p.userId} className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-sunken text-ink-2 text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {getInitials(p.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm truncate">{p.name}</span>
                  <span className="block text-xs text-ink-3 truncate">@{p.username}</span>
                </span>
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded shrink-0 ${p.waitingForFriendship ? 'bg-sunken text-ink-2' : 'bg-warn-soft text-warn'}`}
                  title={p.waitingForFriendship ? 'They get the invitation once they accept your friend request' : 'Waiting for them to accept'}
                >
                  {p.waitingForFriendship ? 'Friend request sent' : 'Invited'}
                </span>
                {isOwner && (
                  <button
                    onClick={() => onWithdraw(p.userId)}
                    className="icon-btn w-7 h-7 shrink-0"
                    aria-label={`Withdraw the invitation to ${p.name}`}
                    title="Withdraw the invitation"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {unassigned > 0 && (
        <p className="px-5 pt-3 text-xs text-ink-3">
          {unassigned} open {unassigned === 1 ? 'card is' : 'cards are'} not assigned to anyone.
        </p>
      )}

      {isOwner && canAdd && (
        <div className="px-5 py-4 space-y-4">
          <InviteByUsername
            id="project-invite-username"
            currentUserId={currentUserId}
            excludeIds={[...project.members, ...project.invited].map((m) => m.userId)}
            onInvite={(username) => onInvite({ username })}
          />
          {candidates === null ? (
            <Spinner className="w-3.5 h-3.5" label="Loading…" />
          ) : candidates.length === 0 ? (
            <p className="text-xs text-ink-2">
              People join once they accept your invitation. Your{' '}
              <Link to="/friends" className="text-accent hover:underline">
                friends
              </Link>
              {project.hackathon ? ' and teammates from the linked hackathon' : ''} appear here for one-click invites.
            </p>
          ) : (
            <div>
              <h3 className="field-label">Friends and teammates</h3>
              <ul className="space-y-2">
                {candidates.map((p) => (
                  <li key={p.userId} className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-sunken text-ink-2 text-[10px] font-semibold flex items-center justify-center shrink-0">
                      {getInitials(p.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm truncate">{p.name}</span>
                      <span className="block text-xs text-ink-3 truncate">
                        @{p.username} · {p.source === 'teammate' ? 'Teammate' : 'Friend'}
                      </span>
                    </span>
                    <button
                      onClick={() => add(p)}
                      disabled={addingId !== null}
                      className="btn btn-secondary text-sm py-1 px-2.5"
                      aria-label={`Invite ${p.name} to the project`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {addingId === p.userId ? 'Inviting…' : 'Invite'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
