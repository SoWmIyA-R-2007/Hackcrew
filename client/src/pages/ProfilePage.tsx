import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Check, KeyRound, LogOut, Trash2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ErrorScreen } from '@/components/ErrorScreen';
import { PageSkeleton } from '@/components/Loading';
import { ToastContainer } from '@/components/ToastContainer';
import { ProfileShowcase } from '@/components/ProfileShowcase';
import { api, type CurrentUser } from '@/lib/api';
import { isNativeApp } from '@/lib/pwa';
import { ToastMessage } from '@/lib/types';
import { cleanUsernameInput, formatDate, generateId, getInitials } from '@/lib/utils';

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Please try again.');

// Results of the Connect Google round trip arrive as ?google=connected or ?error=...
const GOOGLE_LINK_ERRORS: Record<string, string> = {
  google_not_configured:
    'Google sign-in is not set up on this server yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the server environment.',
  google_in_use: 'That Google account is already connected to a different HackTrack account.',
  google_already_connected: 'This account is already connected to another Google account. Disconnect it first.',
  google_unverified: 'That Google account has no verified email address, so it cannot be connected.',
  google_failed: 'Connecting Google did not complete. Try again.',
};

function GoogleLogo() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [googleNotice] = useState(() => {
    if (searchParams.get('google') === 'connected') return { ok: true, text: 'Google is now connected to your account.' };
    const code = searchParams.get('error');
    return code ? { ok: false, text: GOOGLE_LINK_ERRORS[code] ?? 'Connecting Google failed. Try again.' } : null;
  });
  const [disconnecting, setDisconnecting] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [confirmText, setConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .me()
      .then((u) => {
        setUser(u);
        setName(u.name);
        setUsername(u.username ?? '');
      })
      .catch(setLoadError);
  }, [reloadKey]);

  // Drop the one-time ?google / ?error parameters so a reload doesn't show the message again
  useEffect(() => {
    if (searchParams.has('google') || searchParams.has('error')) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleDisconnectGoogle = async () => {
    if (!confirm('Disconnect Google? You will sign in with your email and password only.')) return;
    setDisconnecting(true);
    try {
      setUser(await api.disconnectGoogle());
      addToast('Google disconnected', 'Sign in with your email and password from now on.');
    } catch (err) {
      addToast('Could not disconnect Google', errorMessage(err), 'alert');
    } finally {
      setDisconnecting(false);
    }
  };

  const addToast = (title: string, message: string, type: ToastMessage['type'] = 'success') => {
    const id = `toast-${generateId()}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    try {
      const changes = {
        ...(name.trim() !== user?.name ? { name: name.trim() } : {}),
        ...(username !== (user?.username ?? '') ? { username } : {}),
      };
      const updated = await api.updateProfile(changes);
      const renamed = changes.username !== undefined;
      setUser(updated);
      setName(updated.name);
      setUsername(updated.username ?? '');
      // Lets the header and public profile section refresh without a reload
      window.dispatchEvent(new Event('profile-updated'));
      addToast(
        'Changes saved',
        renamed
          ? `Your username is now @${updated.username}. Use it to sign in${updated.isDemo ? '' : '; your public profile link changed too'}.`
          : `You now appear as ${updated.name}.`
      );
    } catch (err) {
      addToast('Could not save', errorMessage(err), 'alert');
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setSavingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      addToast('Password changed', 'Other devices have been signed out. This one stays signed in.');
    } catch (err) {
      setPasswordError(errorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignOutEverywhere = async () => {
    if (!confirm('Sign out of HackTrack on every device, including this one?')) return;
    try {
      await api.logoutAll();
      navigate('/login');
    } catch (err) {
      addToast('Could not sign out everywhere', errorMessage(err), 'alert');
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    setDeleting(true);
    try {
      await api.deleteAccount(confirmText, user?.hasPassword ? deletePassword : undefined);
      navigate('/login');
    } catch (err) {
      setDeleteError(errorMessage(err));
      setDeleting(false);
    }
  };

  if (loadError !== null) {
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />
        <ErrorScreen
          variant="inline"
          error={loadError}
          onRetry={() => {
            setLoadError(null);
            setReloadKey((k) => k + 1);
          }}
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <PageSkeleton layout="profile" label="Loading your profile" />
        </main>
      </div>
    );
  }

  const confirmWord = user.isDemo ? 'delete' : user.email;
  const nameChanged =
    name.trim().length > 0 &&
    username.length >= 3 &&
    (name.trim() !== user.name || username !== (user.username ?? ''));

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-accent rounded">
          <ArrowLeft className="w-4 h-4" />
          All hackathons
        </Link>

        <div className="mt-5 flex items-center gap-4">
          <span className="w-14 h-14 rounded-full bg-accent-soft text-accent text-lg font-semibold flex items-center justify-center shrink-0">
            {getInitials(user.name)}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold tracking-tight truncate">{user.name}</h1>
            <p className="text-ink-2 truncate">
              {user.username && <span className="text-ink">@{user.username}</span>}
              {user.username && ', '}
              {user.isDemo ? 'demo account' : user.email}
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <ProfileShowcase onToast={addToast} />

          {/* Details */}
          <section aria-labelledby="details-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
            <h2 id="details-heading" className="font-display text-lg font-semibold">
              Details
            </h2>
            <form onSubmit={handleSaveName} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="profile-name" className="field-label">
                    Name
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="field"
                  />
                </div>
                <div>
                  <label htmlFor="profile-username" className="field-label">
                    Username
                  </label>
                  <div className="flex items-center rounded-lg border border-rule-strong bg-surface focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
                    <span className="pl-3 text-sm text-ink-3">@</span>
                    <input
                      id="profile-username"
                      type="text"
                      required
                      minLength={3}
                      maxLength={30}
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(cleanUsernameInput(e.target.value))}
                      className="flex-1 min-w-0 bg-transparent py-2 pl-1 pr-3 text-sm text-ink focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-ink-3">
                Your username is unique. You can sign in with it instead of your email, teammates see it on the team
                list, and it is the address of your public profile.
              </p>
              <button type="submit" className="btn btn-primary" disabled={!nameChanged || savingName}>
                {savingName ? 'Saving…' : 'Save changes'}
              </button>
            </form>
            <dl className="mt-4 text-sm divide-y divide-rule border-t border-rule">
              {!user.isDemo && (
                <div className="flex justify-between gap-4 py-2.5">
                  <dt className="text-ink-3">Email</dt>
                  <dd className="text-ink text-right break-all">{user.email}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-ink-3">Member since</dt>
                <dd className="text-ink text-right">
                  {new Date(user.createdAt).toLocaleDateString('en-US', { dateStyle: 'long' })}
                </dd>
              </div>
              {user.isDemo && (
                <div className="flex justify-between gap-4 py-2.5">
                  <dt className="text-ink-3">Deleted automatically</dt>
                  <dd className="text-ink text-right">{formatDate(user.expiresAt)}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Sign-in */}
          {!user.isDemo && (
            <section aria-labelledby="signin-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
              <h2 id="signin-heading" className="font-display text-lg font-semibold">
                How you sign in
              </h2>
              <ul className="mt-3 text-sm divide-y divide-rule">
                <li className="flex items-center justify-between gap-4 py-2.5">
                  <span className="text-ink">Email address</span>
                  <span className={user.emailVerified ? 'text-ok font-medium inline-flex items-center gap-1' : 'text-warn'}>
                    {user.emailVerified ? (
                      <>
                        <Check className="w-4 h-4" /> Confirmed
                      </>
                    ) : (
                      'Not confirmed yet (check your inbox)'
                    )}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-4 py-2.5">
                  <span className="text-ink">Email and password</span>
                  <span className={user.hasPassword ? 'text-ok font-medium' : 'text-ink-3'}>
                    {user.hasPassword ? 'On' : 'Not set up'}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-4 py-2.5">
                  <span className="text-ink">Google</span>
                  {user.hasGoogle ? (
                    <span className="flex items-center gap-3">
                      <span className="text-ok font-medium inline-flex items-center gap-1">
                        <Check className="w-4 h-4" /> Connected
                      </span>
                      {user.hasPassword && (
                        <button
                          onClick={handleDisconnectGoogle}
                          disabled={disconnecting}
                          className="btn btn-ghost text-sm py-1"
                        >
                          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      )}
                    </span>
                  ) : isNativeApp() ? (
                    // Linking needs the website's session in the browser, which the app does not share
                    <span className="text-xs text-ink-3 text-right max-w-[12rem]">
                      Connect Google from the HackTrack website, then use it in the app.
                    </span>
                  ) : (
                    // A full-page navigation: the server sends the browser to Google and back to this page
                    <a href="/api/auth/google?link=1" className="btn btn-secondary text-sm py-1.5">
                      <GoogleLogo />
                      Connect Google
                    </a>
                  )}
                </li>
              </ul>
              {googleNotice && (
                <p
                  role={googleNotice.ok ? 'status' : 'alert'}
                  className={`mt-2 px-4 py-3 rounded-lg text-sm ${
                    googleNotice.ok ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger'
                  }`}
                >
                  {googleNotice.text}
                </p>
              )}
              {!user.hasGoogle && (
                <p className="mt-2 text-xs text-ink-3">
                  Connect the Google account you use to sign in with one click. Your password keeps working too.
                </p>
              )}

              {user.hasPassword && (
                <form onSubmit={handleChangePassword} className="mt-5 pt-5 border-t border-rule space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-ink-3" />
                    Change password
                  </h3>
                  {passwordError && (
                    <p role="alert" className="px-4 py-3 rounded-lg bg-danger-soft text-danger text-sm">
                      {passwordError}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="current-password" className="field-label">
                        Current password
                      </label>
                      <input
                        id="current-password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="field"
                      />
                    </div>
                    <div>
                      <label htmlFor="new-password" className="field-label">
                        New password
                      </label>
                      <input
                        id="new-password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="field"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-ink-3">At least 8 characters. Other devices will be signed out.</p>
                  <button type="submit" className="btn btn-secondary" disabled={savingPassword}>
                    {savingPassword ? 'Changing…' : 'Change password'}
                  </button>
                </form>
              )}
            </section>
          )}

          {/* Devices (demo accounts cannot sign back in, so this would only lock them out) */}
          {!user.isDemo && (
            <section aria-labelledby="devices-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
              <h2 id="devices-heading" className="font-display text-lg font-semibold">
                Devices
              </h2>
              <p className="mt-2 text-sm text-ink-2">
                Signed in on a shared or lost device? Sign out everywhere, then sign in again here.
              </p>
              <button onClick={handleSignOutEverywhere} className="btn btn-secondary mt-4">
                <LogOut className="w-4 h-4" />
                Sign out of all devices
              </button>
            </section>
          )}

          {/* Delete */}
          <section aria-labelledby="delete-heading" className="bg-surface border border-danger/40 rounded-2xl px-5 py-5">
            <h2 id="delete-heading" className="font-display text-lg font-semibold text-danger">
              Delete account
            </h2>
            <p className="mt-2 text-sm text-ink-2">
              Permanently deletes your account and all of your hackathons, tasks and team lists. This cannot be undone.
            </p>
            <form onSubmit={handleDelete} className="mt-4 space-y-3">
              {deleteError && (
                <p role="alert" className="px-4 py-3 rounded-lg bg-danger-soft text-danger text-sm">
                  {deleteError}
                </p>
              )}
              <div>
                <label htmlFor="delete-confirm" className="field-label">
                  Type <span className="font-semibold text-ink">{confirmWord}</span> to confirm
                </label>
                <input
                  id="delete-confirm"
                  type="text"
                  autoComplete="off"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="field"
                />
              </div>
              {user.hasPassword && (
                <div>
                  <label htmlFor="delete-password" className="field-label">
                    Password
                  </label>
                  <input
                    id="delete-password"
                    type="password"
                    autoComplete="current-password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="field"
                  />
                </div>
              )}
              <button
                type="submit"
                className="btn btn-danger"
                disabled={
                  deleting ||
                  confirmText.trim().toLowerCase() !== confirmWord.toLowerCase() ||
                  (user.hasPassword && !deletePassword)
                }
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting…' : 'Delete my account'}
              </button>
            </form>
          </section>
        </div>
      </main>

      <ToastContainer toasts={toasts} onRemoveToast={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
