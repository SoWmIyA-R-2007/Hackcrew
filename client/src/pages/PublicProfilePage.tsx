import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Wordmark } from '@/components/Navbar';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { ProfileHackathonList } from '@/components/ProfileHackathonList';
import { ProfileLinks } from '@/components/ProfileLinks';
import { ProfileProjectList } from '@/components/ProfileProjectList';
import { api, ApiError } from '@/lib/api';
import { PublicProfile } from '@/lib/types';
import { getInitials } from '@/lib/utils';
import { ErrorScreen } from '@/components/ErrorScreen';
import { PageSkeleton } from '@/components/Loading';

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-surface border border-rule rounded-2xl px-5 py-4">
      <p className="font-display text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm text-ink-2 mt-1">{label}</p>
    </div>
  );
}

/** Shareable profile at /u/:handle, readable without an account */
export default function PublicProfilePage() {
  const handle = useParams().handle ?? '';
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api
      .publicProfile(handle)
      .then((p) => {
        setProfile(p);
        document.title = `${p.name} on HackTrack`;
      })
      // A private or unknown profile is a 404; anything else is a failure worth retrying
      .catch((err) => (err instanceof ApiError && err.status === 404 ? setMissing(true) : setLoadError(err)));
    return () => {
      document.title = 'HackTrack';
    };
  }, [handle, reloadKey]);

  const header = (
    <header className="border-b border-rule">
      <div className="max-w-4xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
        <Link to="/" className="rounded-md">
          <Wordmark />
        </Link>
        <Link to="/login?mode=signup" className="btn btn-secondary text-sm">
          Track your own hackathons
        </Link>
      </div>
    </header>
  );

  if (missing) {
    return (
      <div className="min-h-screen bg-paper">
        {header}
        <main className="max-w-xl mx-auto px-6 py-20 text-center">
          <h1 className="font-display text-2xl font-semibold">Profile not available</h1>
          <p className="mt-2 text-ink-2">This profile is private or does not exist. Check the link with the person who shared it.</p>
        </main>
      </div>
    );
  }

  if (loadError !== null) {
    return (
      <div className="min-h-screen bg-paper">
        {header}
        <ErrorScreen
          variant="inline"
          error={loadError}
          home={{ to: '/', label: 'Go to HackTrack' }}
          onRetry={() => {
            setLoadError(null);
            setReloadKey((k) => k + 1);
          }}
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-paper">
        {header}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <PageSkeleton layout="profile" label="Loading profile" />
        </main>
      </div>
    );
  }

  const finished = profile.hackathons.filter((h) => h.status === 'submitted' || h.status === 'completed').length;
  const shortlisted = profile.hackathons.filter((h) => ['shortlisted', 'finalist', 'winner'].includes(h.result.outcome)).length;
  const wins = profile.hackathons.filter((h) => h.result.outcome === 'winner');
  const firstName = profile.name.split(' ')[0];

  return (
    <div className="min-h-screen bg-paper">
      {header}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        <div className="flex items-center gap-4">
          <span className="w-16 h-16 rounded-full bg-accent-soft text-accent text-xl font-semibold flex items-center justify-center shrink-0">
            {getInitials(profile.name)}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">{profile.name}</h1>
            <p className="text-ink-3">
              @{profile.handle}, on HackTrack since{' '}
              {new Date(profile.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        {profile.bio && <p className="text-lg text-ink-2 max-w-2xl">{profile.bio}</p>}
        <ProfileLinks links={profile.links ?? {}} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat value={profile.hackathons.length} label="Hackathons" />
          <Stat value={finished} label="Submitted" />
          <Stat value={shortlisted} label="Shortlisted or better" />
          <Stat value={wins.length} label={wins.length === 1 ? 'Prize won' : 'Prizes won'} />
        </div>

        <section aria-labelledby="activity-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
          <h2 id="activity-heading" className="font-display text-lg font-semibold">
            Hackathon activity
          </h2>
          <div className="mt-2">
            <ActivityHeatmap hackathons={profile.hackathons} subject={firstName} />
          </div>
        </section>

        {(profile.projects ?? []).length > 0 && (
          <section aria-labelledby="projects-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
            <h2 id="projects-heading" className="font-display text-lg font-semibold">
              Projects
            </h2>
            <ProfileProjectList projects={profile.projects} />
          </section>
        )}

        <section aria-labelledby="hackathons-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
          <h2 id="hackathons-heading" className="font-display text-lg font-semibold">
            Hackathons
          </h2>
          {profile.hackathons.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">{firstName} hasn't shared any hackathons yet.</p>
          ) : (
            <ProfileHackathonList hackathons={profile.hackathons} />
          )}
        </section>
      </main>
    </div>
  );
}
