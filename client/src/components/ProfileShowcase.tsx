import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Copy, ExternalLink, Share2 } from 'lucide-react';
import { api } from '@/lib/api';
import { ProfileSettings } from '@/lib/types';
import { ActivityHeatmap } from './ActivityHeatmap';
import { ProfileHackathonList } from './ProfileHackathonList';
import { ProfileProjectList } from './ProfileProjectList';
import { Spinner } from './Loading';
import { ProfileLinksEditor } from './ProfileLinksEditor';

interface Props {
  onToast: (title: string, message: string, type?: 'success' | 'alert' | 'info') => void;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Please try again.');

/** The profile page's activity heatmap and public profile settings */
export const ProfileShowcase: React.FC<Props> = ({ onToast }) => {
  const [profile, setProfile] = useState<ProfileSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      api
        .myProfile()
        .then((p) => {
          setProfile(p);
          setBio(p.bio);
        })
        .catch((err) => setLoadError(errorMessage(err)));
    load();
    // The public link is the username, so reload after it is changed in Details
    window.addEventListener('profile-updated', load);
    return () => window.removeEventListener('profile-updated', load);
  }, []);

  const publicUrl = profile?.handle ? `${window.location.origin}/u/${profile.handle}` : '';

  const save = async (changes: Parameters<typeof api.updateMyProfile>[0], toast?: [string, string]) => {
    setSaving(true);
    setFormError(null);
    try {
      const updated = await api.updateMyProfile(changes);
      setProfile(updated);
      setBio(updated.bio);
      if (toast) onToast(...toast);
      return true;
    } catch (err) {
      setFormError(errorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save(
      { bio: bio.trim(), isPublic: true },
      profile?.isPublic ? ['Profile saved', 'Your public profile is updated.'] : ['Profile is public', 'Anyone with the link can now see it.']
    );
  };

  const toggleHidden = (id: string, hidden: boolean) => {
    if (!profile) return;
    const ids = new Set(profile.hackathons.filter((h) => h.hidden).map((h) => h.id));
    if (hidden) ids.add(id);
    else ids.delete(id);
    // Show the change straight away; save() replaces it with the server's copy
    setProfile({ ...profile, hackathons: profile.hackathons.map((h) => (h.id === id ? { ...h, hidden } : h)) });
    save({ hiddenHackathonIds: [...ids] });
  };

  const toggleShownProject = (id: string, shown: boolean) => {
    if (!profile) return;
    const ids = new Set(profile.projects.filter((p) => p.shown).map((p) => p.id));
    if (shown) ids.add(id);
    else ids.delete(id);
    setProfile({ ...profile, projects: profile.projects.map((p) => (p.id === id ? { ...p, shown } : p)) });
    save({ shownProjectIds: [...ids] });
  };

  const share = async () => {
    if (!publicUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${profile?.name} on HackTrack`, url: publicUrl });
        return;
      } catch {
        // Cancelled or unsupported: fall back to copying the link
      }
    }
    try {
      await navigator.clipboard.writeText(publicUrl);
      onToast('Link copied', publicUrl);
    } catch {
      onToast('Copy this link', publicUrl, 'info');
    }
  };

  if (loadError) {
    return (
      <p role="alert" className="px-4 py-3 rounded-lg bg-danger-soft text-danger text-sm">
        Could not load your hackathon activity. {loadError}
      </p>
    );
  }
  if (!profile) {
    return (
      <Spinner label="Loading your hackathon activity…" />
    );
  }

  const shownCount = profile.hackathons.filter((h) => !h.hidden).length;
  const bioChanged = bio.trim() !== profile.bio;

  return (
    <>
      <section aria-labelledby="activity-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
        <h2 id="activity-heading" className="font-display text-lg font-semibold">
          Hackathon activity
        </h2>
        <div className="mt-2">
          <ActivityHeatmap hackathons={profile.hackathons} subject="You" />
        </div>
      </section>

      <ProfileLinksEditor
        key={JSON.stringify(profile.links)}
        links={profile.links}
        onToast={onToast}
        onSave={async (links) => {
          const updated = await api.updateMyProfile({ links });
          setProfile(updated);
          return updated.links;
        }}
      />

      <section aria-labelledby="public-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="public-heading" className="font-display text-lg font-semibold">
            Public profile
          </h2>
          <span className={`text-sm font-medium ${profile.isPublic ? 'text-ok' : 'text-ink-3'}`}>
            {profile.isPublic ? 'Public' : 'Private'}
          </span>
        </div>

        {!profile.canBePublic ? (
          <p className="mt-2 text-sm text-ink-2">
            Demo accounts can't have a public profile. Create your own account to share your hackathons.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-2 max-w-prose">
              A page you can share with anyone, even people without an account. It shows your name, bio, the activity
              above, and the hackathons you choose below with your team role, result and prize. Your email, tasks,
              problem statements and teammates' details are never shown.
            </p>

            {profile.isPublic && (
              <div className="mt-4 flex flex-wrap items-center gap-2 bg-sunken rounded-xl px-4 py-3">
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-accent font-medium break-all hover:underline">
                  {publicUrl.replace(/^https?:\/\//, '')}
                </a>
                <span className="flex-1" />
                <button onClick={share} className="btn btn-primary text-sm py-1.5">
                  {typeof navigator.share === 'function' ? <Share2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  Share
                </button>
                <Link to={`/u/${profile.handle}`} className="btn btn-secondary text-sm py-1.5">
                  <ExternalLink className="w-4 h-4" />
                  View
                </Link>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              {formError && (
                <p role="alert" className="px-4 py-3 rounded-lg bg-danger-soft text-danger text-sm">
                  {formError}
                </p>
              )}
              <p className="text-sm text-ink-2">
                Your profile address is{' '}
                <span className="font-medium text-ink">
                  {window.location.host}/u/{profile.handle}
                </span>
                . It follows your username, which you can change under Details.
              </p>
              <div>
                <label htmlFor="profile-bio" className="field-label">
                  Short bio (optional)
                </label>
                <textarea
                  id="profile-bio"
                  rows={2}
                  maxLength={160}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Full-stack developer who loves AI hackathons"
                  className="field resize-y"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.isPublic ? (
                  <>
                    <button type="submit" className="btn btn-primary" disabled={saving || !bioChanged}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => save({ isPublic: false }, ['Profile is private', 'The public link no longer works.'])}
                      className="btn btn-secondary"
                    >
                      Make private
                    </button>
                  </>
                ) : (
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Make my profile public'}
                  </button>
                )}
              </div>
            </form>
          </>
        )}

        <div className="mt-6 pt-4 border-t border-rule">
          <h3 className="text-sm font-semibold">
            Your hackathons{' '}
            {profile.canBePublic && (
              <span className="font-normal text-ink-3">
                ({shownCount} of {profile.hackathons.length} shown publicly)
              </span>
            )}
          </h3>
          {profile.hackathons.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">Hackathons you add or join will appear here.</p>
          ) : (
            <ProfileHackathonList
              hackathons={profile.hackathons}
              onToggleHidden={profile.canBePublic ? toggleHidden : undefined}
            />
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-rule">
          <h3 className="text-sm font-semibold">
            Your projects{' '}
            {profile.canBePublic && profile.projects.length > 0 && (
              <span className="font-normal text-ink-3">
                ({profile.projects.filter((p) => p.shown && p.status !== 'archived').length} of {profile.projects.length} shown
                publicly)
              </span>
            )}
          </h3>
          {profile.projects.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">Projects you start or collaborate on will appear here.</p>
          ) : (
            <>
              {profile.canBePublic && (
                <p className="mt-1 text-xs text-ink-3">
                  Projects stay off your public profile until you tick them. Only the name, pitch, status, tech stack and the
                  code and demo links are shown; archived projects are never shown.
                </p>
              )}
              <ProfileProjectList
                projects={profile.projects}
                onToggleShown={profile.canBePublic ? toggleShownProject : undefined}
              />
            </>
          )}
        </div>
      </section>
    </>
  );
};
