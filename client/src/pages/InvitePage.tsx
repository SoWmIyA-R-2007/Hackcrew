import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AuthShell } from '@/components/AuthShell';
import { Spinner } from '@/components/Loading';
import { api, type CurrentUser } from '@/lib/api';

type Invite = Awaited<ReturnType<typeof api.getInvite>>;

export default function InvitePage() {
  const navigate = useNavigate();
  const token = useParams().token ?? '';
  const [invite, setInvite] = useState<Invite | null>(null);
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api
      .getInvite(token)
      .then(setInvite)
      .catch((err) => setError(err instanceof Error ? err.message : 'This invite could not be loaded.'));
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, [token]);

  const next = encodeURIComponent(`/invite/${token}`);

  const accept = async () => {
    setJoining(true);
    setError(null);
    try {
      const { hackathonId } = await api.acceptInvite(token);
      window.dispatchEvent(new Event('hackathons-changed'));
      navigate(`/dashboard/hackathons/${hackathonId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the team.');
      setJoining(false);
    }
  };

  if (error && !invite) {
    return (
      <AuthShell title="Invite not available">
        <p className="mt-2 text-ink-2" role="alert">
          {error}
        </p>
        <Link to="/dashboard" className="btn btn-secondary mt-6">
          Go to HackTrack
        </Link>
      </AuthShell>
    );
  }

  if (!invite || user === undefined) {
    return (
      <AuthShell title="Loading invite…">
        <div className="mt-4">
          <Spinner label="One moment." />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={`Join team ${invite.teamName}`}>
      <p className="mt-2 text-ink-2">
        {invite.inviterName} invited you to work on <span className="font-medium text-ink">{invite.hackathonTitle}</span>{' '}
        together. You'll see its problem statement, tasks and deadlines, and get its reminder emails.
      </p>
      {error && (
        <p role="alert" className="mt-6 px-4 py-3 rounded-lg bg-danger-soft text-danger text-sm">
          {error}
        </p>
      )}
      {user && !user.isDemo ? (
        <>
          <button onClick={accept} disabled={joining} className="btn btn-primary w-full h-11 mt-6">
            {joining ? 'Joining…' : 'Accept and open the hackathon'}
          </button>
          <p className="mt-3 text-xs text-ink-3">
            Signed in as {user.email}.
            {user.email !== invite.email && ` The invite was sent to ${invite.email}.`}
          </p>
        </>
      ) : (
        <div className="mt-6 space-y-2">
          {user?.isDemo ? (
            <>
              <p className="text-sm text-ink-2">Demo accounts can't join teams.</p>
              <button
                onClick={async () => {
                  await api.logout().catch(() => {});
                  navigate(`/login?mode=signup&next=${next}`);
                }}
                className="btn btn-primary w-full h-11"
              >
                Leave the demo and create an account
              </button>
            </>
          ) : (
            <>
              <Link to={`/login?mode=signup&next=${next}`} className="btn btn-primary w-full h-11">
                Create an account to join
              </Link>
              <Link to={`/login?next=${next}`} className="btn btn-secondary w-full h-11">
                I already have an account
              </Link>
            </>
          )}
        </div>
      )}
    </AuthShell>
  );
}
