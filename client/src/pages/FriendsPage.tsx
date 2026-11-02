import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Check, UserMinus, UserPlus, X } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ToastContainer } from '@/components/ToastContainer';
import { InlineError } from '@/components/ErrorScreen';
import { Spinner } from '@/components/Loading';
import { api, type CurrentUser } from '@/lib/api';
import { FriendsOverview, HackathonView, PersonSummary, ProjectInvite, TeamInvite, ToastMessage } from '@/lib/types';
import { cleanUsernameInput, generateId, getInitials } from '@/lib/utils';

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Please try again.');
// Lets the header refresh notifications (friend requests and invites appear there too)
const announceChange = () => window.dispatchEvent(new Event('hackathons-changed'));

function Person({ person, note, children }: { person: PersonSummary; note?: string; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className="w-9 h-9 rounded-full bg-accent-soft text-accent text-xs font-semibold flex items-center justify-center shrink-0">
        {getInitials(person.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{person.name}</p>
        <p className="text-xs text-ink-3 truncate">
          {person.profilePublic ? (
            <Link to={`/u/${person.username}`} className="hover:text-accent">
              @{person.username}
            </Link>
          ) : (
            `@${person.username}`
          )}
        </p>
        {note && <p className="text-xs text-accent mt-0.5">{note}</p>}
      </div>
      {children}
    </li>
  );
}

export default function FriendsPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<FriendsOverview | null>(null);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [projectInvites, setProjectInvites] = useState<ProjectInvite[]>([]);
  const [myHackathons, setMyHackathons] = useState<HackathonView[]>([]);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PersonSummary[]>([]);
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Which of my hackathons is picked in each friend's "Invite to a team" menu
  const [inviteTarget, setInviteTarget] = useState<Record<string, string>>({});

  const addToast = (title: string, message: string, type: ToastMessage['type'] = 'success') => {
    const id = `toast-${generateId()}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  };

  const load = useCallback(
    () =>
      Promise.all([api.friends(), api.myTeamInvites(), api.listHackathons(), api.myProjectInvites()])
        .then(([o, i, h, p]) => {
          setOverview(o);
          setInvites(i);
          setProjectInvites(p);
          setMyHackathons(h.filter((x) => x.role !== 'member' && x.status !== 'completed'));
        })
        .catch(setLoadError),
    []
  );

  useEffect(() => {
    load();
    api
      .me()
      .then(setMe)
      .catch(() => {});
  }, [load]);

  // Suggest people as a username is typed (after a short pause)
  useEffect(() => {
    const q = query.trim();
    const timer = setTimeout(() => {
      if (q.length < 2) {
        setSuggestions([]);
        return;
      }
      api
        .searchPeople(q)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const run = async (id: string, action: () => Promise<unknown>, success?: [string, string]) => {
    setBusyId(id);
    try {
      await action();
      if (success) addToast(...success);
      await load();
      announceChange();
    } catch (err) {
      addToast('Something went wrong', errorMessage(err), 'alert');
    } finally {
      setBusyId(null);
    }
  };

  const sendRequest = async (username: string) => {
    const name = cleanUsernameInput(username);
    if (!name) return;
    setSending(true);
    try {
      const { status, person } = await api.sendFriendRequest(name);
      addToast(
        status === 'accepted' ? 'You are now friends' : 'Friend request sent',
        status === 'accepted'
          ? `${person.name} had already asked you, so you're friends now.`
          : `${person.name} (@${person.username}) can accept it from their Friends page.`
      );
      setQuery('');
      setSuggestions([]);
      await load();
    } catch (err) {
      addToast('Could not send the request', errorMessage(err), 'alert');
    } finally {
      setSending(false);
    }
  };

  const inviteToTeam = (friend: PersonSummary) => {
    const hackathonId = inviteTarget[friend.userId];
    const h = myHackathons.find((x) => x.id === hackathonId);
    if (!h) return;
    run(friend.userId, () => api.inviteFriend(h.id, friend.userId, 'Developer'), [
      'Invite sent',
      `${friend.name} was invited to team ${h.teamName} for ${h.title}.`,
    ]);
  };

  /** My hackathons this friend is not already on or invited to */
  const invitableFor = (friend: PersonSummary) =>
    myHackathons.filter(
      (h) => !h.operatives.some((o) => o.userId === friend.userId || o.invitedUserId === friend.userId)
    );

  if (me?.isDemo) {
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Friends</h1>
          <p className="mt-2 text-ink-2">Demo accounts can't add friends. Create your own account to build a friend list.</p>
        </main>
      </div>
    );
  }

  const friends = overview?.friends ?? [];
  const known = new Set([
    ...friends.map((f) => f.userId),
    ...(overview?.outgoing ?? []).map((r) => r.person.userId),
    ...(overview?.incoming ?? []).map((r) => r.person.userId),
  ]);

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Friends</h1>
          <p className="mt-2 text-ink-2">
            Add friends by username, then invite them to any of your teams or projects with one click.
          </p>
        </div>

        {loadError !== null && (
          <InlineError
            error={loadError}
            what="your friends"
            onRetry={() => {
              setLoadError(null);
              load();
            }}
          />
        )}

        {invites.length + projectInvites.length > 0 && (
          <section aria-labelledby="invites-heading" className="bg-surface border border-accent rounded-2xl">
            <h2 id="invites-heading" className="font-display text-lg font-semibold px-5 pt-5 pb-3">
              Invitations ({invites.length + projectInvites.length})
            </h2>
            <ul className="divide-y divide-rule border-t border-rule">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {i.invitedBy} invited you to team {i.teamName}
                    </p>
                    <p className="text-xs text-ink-3">
                      {i.hackathonTitle}, as {i.role}
                    </p>
                  </div>
                  <button
                    disabled={busyId === i.id}
                    onClick={async () => {
                      setBusyId(i.id);
                      try {
                        const { hackathonId } = await api.acceptTeamInvite(i.id);
                        announceChange();
                        navigate(`/dashboard/hackathons/${hackathonId}`);
                      } catch (err) {
                        addToast('Could not join', errorMessage(err), 'alert');
                        setBusyId(null);
                        load();
                      }
                    }}
                    className="btn btn-primary text-sm py-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Join team
                  </button>
                  <button
                    disabled={busyId === i.id}
                    onClick={() => run(i.id, () => api.declineTeamInvite(i.id), ['Invite declined', `You were taken off team ${i.teamName}.`])}
                    className="btn btn-ghost text-sm py-1.5"
                  >
                    Decline
                  </button>
                </li>
              ))}
              {projectInvites.map((i) => (
                <li key={`project-${i.projectId}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {i.invitedBy} invited you to the project {i.projectTitle}
                    </p>
                    {i.tagline && <p className="text-xs text-ink-3 truncate">{i.tagline}</p>}
                  </div>
                  <button
                    disabled={busyId === i.projectId}
                    onClick={async () => {
                      setBusyId(i.projectId);
                      try {
                        await api.acceptProjectInvite(i.projectId);
                        announceChange();
                        navigate(`/projects/${i.projectId}`);
                      } catch (err) {
                        addToast('Could not join', errorMessage(err), 'alert');
                        setBusyId(null);
                        load();
                      }
                    }}
                    className="btn btn-primary text-sm py-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Join project
                  </button>
                  <button
                    disabled={busyId === i.projectId}
                    onClick={() =>
                      run(i.projectId, () => api.declineProjectInvite(i.projectId), [
                        'Invitation declined',
                        `You won't join ${i.projectTitle}.`,
                      ])
                    }
                    className="btn btn-ghost text-sm py-1.5"
                  >
                    Decline
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {overview && overview.incoming.length > 0 && (
          <section aria-labelledby="incoming-heading" className="bg-surface border border-rule rounded-2xl">
            <h2 id="incoming-heading" className="font-display text-lg font-semibold px-5 pt-5 pb-3">
              Friend requests ({overview.incoming.length})
            </h2>
            <ul className="divide-y divide-rule border-t border-rule">
              {overview.incoming.map((r) => (
                <Person
                  key={r.id}
                  person={r.person}
                  note={r.heldInvites?.length ? `Also invited you to ${r.heldInvites.join(' and ')}. Accept to see it.` : undefined}
                >
                  <button
                    disabled={busyId === r.id}
                    onClick={() =>
                      run(r.id, () => api.acceptFriendRequest(r.id), [
                        'Friend added',
                        r.heldInvites?.length
                          ? `You and ${r.person.name} are now friends. Their invitation is under Invitations.`
                          : `You and ${r.person.name} are now friends.`,
                      ])
                    }
                    className="btn btn-primary text-sm py-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Accept
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() =>
                      run(
                        r.id,
                        () => api.deleteFriendRequest(r.id),
                        r.heldInvites?.length ? ['Request declined', 'The invitation that came with it was declined too.'] : undefined
                      )
                    }
                    className="btn btn-ghost text-sm py-1.5"
                  >
                    Decline
                  </button>
                </Person>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="add-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
          <h2 id="add-heading" className="font-display text-lg font-semibold">
            Add a friend
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendRequest(query);
            }}
            className="mt-3 flex gap-2"
          >
            <label htmlFor="friend-username" className="sr-only">
              Username
            </label>
            <div className="relative flex-1">
              <div className="flex items-center rounded-lg border border-rule-strong bg-surface focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
                <span className="pl-3 text-sm text-ink-3">@</span>
                <input
                  id="friend-username"
                  value={query}
                  onChange={(e) => setQuery(cleanUsernameInput(e.target.value))}
                  placeholder="their-username"
                  autoComplete="off"
                  className="flex-1 min-w-0 bg-transparent py-2 pl-1 pr-3 text-sm text-ink focus:outline-none"
                />
              </div>
              {suggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-surface border border-rule rounded-lg shadow-lg overflow-hidden">
                  {suggestions.map((p) => (
                    <li key={p.userId}>
                      <button
                        type="button"
                        disabled={known.has(p.userId)}
                        onClick={() => sendRequest(p.username)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-sunken disabled:opacity-60 cursor-pointer"
                      >
                        <span className="min-w-0 truncate">
                          {p.name} <span className="text-ink-3">@{p.username}</span>
                        </span>
                        <span className="text-xs text-ink-3 shrink-0">
                          {known.has(p.userId) ? 'Already added' : 'Add friend'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="submit" className="btn btn-primary" disabled={sending || query.length < 3}>
              <UserPlus className="w-4 h-4" />
              {sending ? 'Sending…' : 'Send request'}
            </button>
          </form>
          {me?.username && (
            <p className="mt-2 text-xs text-ink-3">
              Your username is @{me.username}. Share it so friends can add you.
            </p>
          )}
        </section>

        <section aria-labelledby="friends-heading" className="bg-surface border border-rule rounded-2xl">
          <h2 id="friends-heading" className="font-display text-lg font-semibold px-5 pt-5 pb-3">
            Your friends {overview && <span className="text-ink-3 font-normal text-base">({friends.length})</span>}
          </h2>
          {!overview && loadError === null && (
            <div className="px-5 pb-5">
              <Spinner label="Loading your friends…" />
            </div>
          )}
          {overview && friends.length === 0 && (
            <p className="px-5 pb-5 text-sm text-ink-2">No friends yet. Add someone by their username above.</p>
          )}
          {friends.length > 0 && (
            <ul className="divide-y divide-rule border-t border-rule">
              {friends.map((f) => {
                const options = invitableFor(f);
                return (
                  <Person key={f.userId} person={f}>
                    {options.length > 0 && (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <label htmlFor={`invite-${f.userId}`} className="sr-only">
                          Invite {f.name} to a team
                        </label>
                        <select
                          id={`invite-${f.userId}`}
                          value={inviteTarget[f.userId] ?? ''}
                          onChange={(e) => setInviteTarget((t) => ({ ...t, [f.userId]: e.target.value }))}
                          className="field py-1.5 flex-1 sm:w-48"
                        >
                          <option value="">Invite to a team…</option>
                          {options.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.title}
                            </option>
                          ))}
                        </select>
                        <button
                          disabled={!inviteTarget[f.userId] || busyId === f.userId}
                          onClick={() => inviteToTeam(f)}
                          className="btn btn-secondary text-sm py-1.5"
                        >
                          Invite
                        </button>
                      </div>
                    )}
                    <button
                      disabled={busyId === f.userId}
                      onClick={() => {
                        if (confirm(`Remove ${f.name} from your friends?`)) run(f.userId, () => api.removeFriend(f.userId));
                      }}
                      className="icon-btn hover:text-danger"
                      aria-label={`Remove ${f.name} from friends`}
                      title="Remove friend"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </Person>
                );
              })}
            </ul>
          )}
        </section>

        {overview && overview.outgoing.length > 0 && (
          <section aria-labelledby="outgoing-heading" className="bg-surface border border-rule rounded-2xl">
            <h2 id="outgoing-heading" className="font-display text-lg font-semibold px-5 pt-5 pb-3">
              Requests you sent
            </h2>
            <ul className="divide-y divide-rule border-t border-rule">
              {overview.outgoing.map((r) => (
                <Person key={r.id} person={r.person}>
                  <span className="text-xs text-ink-3">Waiting</span>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => run(r.id, () => api.deleteFriendRequest(r.id))}
                    className="icon-btn"
                    aria-label={`Cancel request to ${r.person.name}`}
                    title="Cancel request"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </Person>
              ))}
            </ul>
          </section>
        )}
      </main>
      <ToastContainer toasts={toasts} onRemoveToast={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
