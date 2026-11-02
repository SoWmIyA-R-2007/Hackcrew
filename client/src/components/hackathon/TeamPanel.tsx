import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { LogOut, UserMinus, UserPlus } from 'lucide-react';
import { HackathonView, PersonSummary } from '@/lib/types';
import { api } from '@/lib/api';
import { getInitials } from '@/lib/utils';
import { InviteByUsername } from '@/components/InviteByUsername';
import { Spinner } from '@/components/Loading';

const ROLES = ['Developer', 'Frontend lead', 'Backend lead', 'AI / ML', 'Designer', 'Pitch lead'];

interface Props {
  hackathon: HackathonView;
  currentUserId: string | null;
  canEmail: boolean;
  onInvite: (email: string, role: string) => Promise<boolean>;
  onInviteFriend: (friend: PersonSummary, role: string) => Promise<boolean>;
  onInviteByUsername: (username: string, role: string) => Promise<boolean>;
  onRemove: (operativeId: string) => void;
}

export const TeamPanel: React.FC<Props> = ({
  hackathon,
  currentUserId,
  canEmail,
  onInvite,
  onInviteFriend,
  onInviteByUsername,
  onRemove,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Developer');
  const [busy, setBusy] = useState(false);
  const [friends, setFriends] = useState<PersonSummary[] | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const isOwner = hackathon.role !== 'member';

  // Friends are only needed by the owner, who is the one who can invite (demo accounts have none)
  useEffect(() => {
    if (!isOwner || !canEmail) return;
    api
      .friends()
      .then((o) => setFriends(o.friends))
      .catch(() => setFriends([]));
  }, [isOwner, canEmail]);

  // Friends not already on the team or invited
  const invitable = (friends ?? []).filter(
    (f) => !hackathon.operatives.some((o) => o.userId === f.userId || o.invitedUserId === f.userId)
  );

  const inviteFriend = async (friend: PersonSummary) => {
    setInvitingId(friend.userId);
    await onInviteFriend(friend, role);
    setInvitingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    if (await onInvite(email.trim(), role)) setEmail('');
    setBusy(false);
  };

  return (
    <section aria-labelledby="team-heading" className="bg-surface border border-rule rounded-2xl">
      <div className="flex items-baseline justify-between px-5 pt-5 pb-3">
        <h2 id="team-heading" className="font-display text-lg font-semibold">
          Team
        </h2>
        <span className="text-sm text-ink-3">{hackathon.operatives.length} people</span>
      </div>
      <ul className="divide-y divide-rule border-y border-rule">
        {hackathon.operatives.map((op) => {
          const isMe = Boolean(currentUserId && op.userId === currentUserId);
          // The creator is listed as op-<their user id> and cannot be removed
          const isLead = op.id === `op-${op.userId}`;
          return (
            <li key={op.id} className="flex items-center gap-3 px-5 py-3">
              <span className="w-9 h-9 rounded-full bg-accent-soft text-accent text-xs font-semibold flex items-center justify-center shrink-0">
                {getInitials(op.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {op.name}
                  {isMe && <span className="text-ink-3 font-normal"> (you)</span>}
                </p>
                <p className="text-xs text-ink-3 truncate">
                  {op.username && <span className="text-ink-2">@{op.username}, </span>}
                  {op.role}
                  {op.email && `, ${op.email}`}
                </p>
              </div>
              {op.invitePending && op.awaitingFriend ? (
                <span
                  className="text-xs px-2 py-0.5 rounded-md bg-sunken text-ink-2 shrink-0"
                  title="They get the team invite once they accept your friend request"
                >
                  Friend request sent
                </span>
              ) : op.invitePending ? (
                <span className="text-xs px-2 py-0.5 rounded-md bg-warn-soft text-warn shrink-0" title="Invited, has not joined yet">
                  Invited
                </span>
              ) : op.userId ? (
                <span className="text-xs px-2 py-0.5 rounded-md bg-ok-soft text-ok shrink-0" title="Has a Hackcrew account on this team">
                  Joined
                </span>
              ) : null}
              {isMe && !isOwner ? (
                <button
                  onClick={() => onRemove(op.id)}
                  className="icon-btn w-8 h-8 hover:text-danger"
                  aria-label="Leave this team"
                  title="Leave this team"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              ) : (
                isOwner &&
                !isLead && (
                  <button
                    onClick={() => onRemove(op.id)}
                    className="icon-btn w-8 h-8 hover:text-danger"
                    aria-label={`Remove ${op.name} from the team`}
                    title="Remove from team"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>

      {isOwner ? (
        <div className="px-5 py-4 space-y-4">
          <div>
            <label htmlFor="invite-role" className="field-label">
              Role for new teammates
            </label>
            <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)} className="field">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {canEmail && (
            <div>
              <p className="field-label">Invite friends</p>
              {friends === null ? (
                <Spinner className="w-3.5 h-3.5" label="Loading your friends…" />
              ) : invitable.length === 0 ? (
                <p className="text-xs text-ink-3">
                  {friends.length === 0 ? (
                    <>
                      No friends yet.{' '}
                      <Link to="/friends" className="text-accent hover:underline">
                        Add friends
                      </Link>{' '}
                      to invite them here with one click.
                    </>
                  ) : (
                    'All your friends are already on this team.'
                  )}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {invitable.map((f) => (
                    <li key={f.userId} className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-sunken text-ink-2 text-[11px] font-semibold flex items-center justify-center shrink-0">
                        {getInitials(f.name)}
                      </span>
                      <span className="min-w-0 flex-1 text-sm truncate">
                        {f.name} <span className="text-ink-3">@{f.username}</span>
                      </span>
                      <button
                        onClick={() => inviteFriend(f)}
                        disabled={invitingId !== null}
                        className="btn btn-secondary text-sm py-1"
                        aria-label={`Invite ${f.name} as ${role}`}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        {invitingId === f.userId ? 'Inviting…' : 'Invite'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {canEmail && (
            <InviteByUsername
              id="invite-username"
              currentUserId={currentUserId}
              excludeIds={hackathon.operatives.flatMap((o) => [o.userId, o.invitedUserId].filter((v): v is string => Boolean(v)))}
              onInvite={(username) => onInviteByUsername(username, role)}
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-2">
            <label htmlFor="invite-email" className="field-label">
              Or invite by email
            </label>
            <div className="flex gap-2">
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="field flex-1"
              />
              <button type="submit" className="btn btn-primary" disabled={busy}>
                <UserPlus className="w-4 h-4" />
                {busy ? 'Inviting…' : 'Invite'}
              </button>
            </div>
            <p className="text-xs text-ink-3">
              {canEmail
                ? 'They get an invite to join. Once they accept, they can see and edit this hackathon.'
                : 'Demo accounts can list teammates but cannot send invite emails.'}
            </p>
          </form>
        </div>
      ) : (
        <p className="px-5 py-4 text-xs text-ink-3">Only the person who added this hackathon can invite or remove teammates.</p>
      )}
    </section>
  );
};
