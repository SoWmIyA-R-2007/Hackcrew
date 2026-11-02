import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { PersonSummary } from '@/lib/types';
import { cleanUsernameInput, getInitials } from '@/lib/utils';

interface Props {
  id: string;
  // Accounts already on the team or project, or invited, so they are not suggested
  excludeIds: string[];
  currentUserId: string | null;
  onInvite: (username: string) => Promise<boolean>;
}

/**
 * A username box with suggestions (friends first). Friends get the invitation straight away; anyone else
 * gets a friend request first, and the invitation reaches them once they accept it
 */
export const InviteByUsername: React.FC<Props> = ({ id, excludeIds, currentUserId, onInvite }) => {
  const [value, setValue] = useState('');
  const [friends, setFriends] = useState<PersonSummary[]>([]);
  const [found, setFound] = useState<PersonSummary[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .friends()
      .then((o) => setFriends(o.friends))
      .catch(() => {
        // Suggestions are optional; typing a username still works
      });
  }, []);

  // Search everyone once two characters are typed, after a short pause
  useEffect(() => {
    if (value.length < 2) return;
    const timer = setTimeout(() => {
      api
        .searchPeople(value)
        .then(setFound)
        .catch(() => setFound([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [value]);

  const excluded = new Set([...excludeIds, ...(currentUserId ? [currentUserId] : [])]);
  const friendIds = new Set(friends.map((f) => f.userId));
  const matchingFriends = friends.filter((f) => !excluded.has(f.userId) && (!value || f.username.startsWith(value)));
  const others = value.length >= 2 ? found.filter((p) => !excluded.has(p.userId) && !friendIds.has(p.userId)) : [];
  const suggestions = [...matchingFriends.slice(0, 4), ...others.slice(0, 3)];
  const exact = [...friends, ...found].find((p) => p.username === value);
  const exactIsFriend = exact ? friendIds.has(exact.userId) : false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    setBusy(true);
    if (await onInvite(value)) setValue('');
    setBusy(false);
  };

  return (
    <form onSubmit={submit}>
      <label htmlFor={id} className="field-label">
        Invite by username
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3 pointer-events-none" aria-hidden="true">
            @
          </span>
          <input
            id={id}
            value={value}
            onChange={(e) => {
              setValue(cleanUsernameInput(e.target.value));
              setFound([]);
            }}
            placeholder="username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="field pl-7"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || !value}>
          <UserPlus className="w-4 h-4" />
          {busy ? 'Inviting…' : 'Invite'}
        </button>
      </div>

      {value && exact && !excluded.has(exact.userId) && (
        <p className="mt-1.5 text-xs text-ink-2">
          {exactIsFriend
            ? `${exact.name} is your friend, so they get the invitation now.`
            : `${exact.name} is not your friend yet. They get a friend request first, and the invitation once they accept.`}
        </p>
      )}
      {value && exact && excluded.has(exact.userId) && <p className="mt-1.5 text-xs text-ink-3">{exact.name} is already here.</p>}

      {suggestions.length > 0 && !(exact && exact.username === value) && (
        <ul className="mt-2 space-y-1" aria-label="Suggestions">
          {suggestions.map((p) => (
            <li key={p.userId}>
              <button
                type="button"
                onClick={() => setValue(p.username)}
                className="w-full flex items-center gap-2 text-left rounded-lg px-1.5 py-1 hover:bg-sunken cursor-pointer"
              >
                <span className="w-6 h-6 rounded-full bg-sunken text-ink-2 text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {getInitials(p.name)}
                </span>
                <span className="min-w-0 flex-1 text-sm truncate">
                  {p.name} <span className="text-ink-3">@{p.username}</span>
                </span>
                <span className={`text-[11px] shrink-0 ${friendIds.has(p.userId) ? 'text-ok' : 'text-ink-3'}`}>
                  {friendIds.has(p.userId) ? 'Friend' : 'Not a friend yet'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!value && friends.length === 0 && (
        <p className="mt-1.5 text-xs text-ink-3">
          Type anyone's username. Your{' '}
          <Link to="/friends" className="text-accent hover:underline">
            friends
          </Link>{' '}
          show up here as suggestions.
        </p>
      )}
    </form>
  );
};
