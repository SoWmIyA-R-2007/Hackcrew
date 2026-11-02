import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, safeNextPath } from '@/lib/api';
import { cleanUsernameInput, suggestUsername } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';
import { Wordmark } from '@/components/Navbar';

const GOOGLE_ERRORS: Record<string, string> = {
  google_not_configured:
    'Google sign-in is not set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the server environment.',
  google_failed: 'Google sign-in did not complete. Try again.',
  google_unverified: 'Your Google account email is not verified, so it cannot be used to sign in.',
  google_conflict: 'This email is already linked to a different Google account. Sign in with that Google account instead.',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'signup'>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
  );
  const [demoLoading, setDemoLoading] = useState(false);
  // Where to go after signing in, e.g. back to an invite link
  const next = safeNextPath(searchParams.get('next')) ?? '/dashboard';
  const [name, setName] = useState('');
  // Follows the name until the person edits it themselves
  const [usernameEdit, setUsernameEdit] = useState<string | null>(null);
  const username = usernameEdit ?? suggestUsername(name);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Errors from the Google redirect arrive as ?error=...
  const [errorMsg, setErrorMsg] = useState<string | null>(() => {
    const code = searchParams.get('error');
    return code ? (GOOGLE_ERRORS[code] ?? 'Sign-in failed. Try again.') : null;
  });

  const isSignup = mode === 'signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      if (isSignup) {
        await api.signup(name, email, password, username || undefined);
      } else {
        await api.login(email, password);
      }
      navigate(next);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    setErrorMsg(null);
    try {
      await api.demo();
      navigate(next);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not start the demo. Try again.');
      setDemoLoading(false);
    }
  };

  const switchMode = () => {
    setMode(isSignup ? 'signin' : 'signup');
    setErrorMsg(null);
  };

  // A static preview of the dashboard timeline for the side panel
  const previewBars = [
    { name: 'Climate Challenge', left: 4, width: 34, fill: 100, tone: 'bg-ok', soft: 'bg-ok-soft' },
    { name: 'AI Innovators', left: 22, width: 48, fill: 65, tone: 'bg-accent', soft: 'bg-accent-soft' },
    { name: 'CyberOps Summit', left: 30, width: 44, fill: 40, tone: 'bg-accent', soft: 'bg-accent-soft' },
    { name: 'FinTech Sprint', left: 58, width: 36, fill: 0, tone: 'bg-ink-3', soft: 'bg-sunken' },
  ];

  return (
    <div className="min-h-screen bg-paper grid lg:grid-cols-2">
      <main className="flex flex-col px-6 sm:px-10 py-8">
        <Wordmark />

        <div className="flex-1 flex items-center">
          <div className="w-full max-w-sm mx-auto lg:mx-0 lg:ml-[12%] py-12">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {isSignup ? 'Create your account' : 'Sign in'}
            </h1>
            <p className="mt-2 text-ink-2">
              {isSignup
                ? 'Your hackathons are saved to your account, so they follow you to any device.'
                : 'Pick up where you left off with your hackathons.'}
            </p>

            {searchParams.get('expired') && !errorMsg && (
              <div role="status" className="mt-6 px-4 py-3 rounded-lg bg-warn-soft text-warn text-sm">
                Your session ended. Sign in again to pick up where you left off.
              </div>
            )}

            {errorMsg && (
              <div role="alert" className="mt-6 px-4 py-3 rounded-lg bg-danger-soft text-danger text-sm">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {isSignup && (
                <div>
                  <label className="field-label" htmlFor="name">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="field"
                  />
                </div>
              )}
              {isSignup && (
                <div>
                  <label className="field-label" htmlFor="username">
                    Username
                  </label>
                  <div className="flex items-center rounded-lg border border-rule-strong bg-surface focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
                    <span className="pl-3 text-sm text-ink-3">@</span>
                    <input
                      id="username"
                      type="text"
                      required
                      minLength={3}
                      maxLength={30}
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsernameEdit(cleanUsernameInput(e.target.value))}
                      placeholder="your-name"
                      className="flex-1 min-w-0 bg-transparent py-2 pl-1 pr-3 text-sm text-ink focus:outline-none"
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-3">Letters, numbers and dashes. You can sign in with it and change it later.</p>
                </div>
              )}
              <div>
                <label className="field-label" htmlFor="email">
                  {isSignup ? 'Email' : 'Email or username'}
                </label>
                <input
                  id="email"
                  type={isSignup ? 'email' : 'text'}
                  required
                  autoComplete={isSignup ? 'email' : 'username'}
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isSignup ? 'name@example.com' : 'name@example.com or your-username'}
                  className="field"
                />
              </div>

              <div>
                <div className="flex justify-between items-baseline">
                  <label className="field-label" htmlFor="password">
                    Password
                  </label>
                  {isSignup ? (
                    <span className="text-xs text-ink-3">At least 8 characters</span>
                  ) : (
                    <Link to="/forgot-password" className="text-sm text-accent hover:underline">
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    minLength={isSignup ? 8 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 px-3 text-ink-3 hover:text-ink cursor-pointer rounded-r-lg"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary w-full h-11">
                {loading ? (isSignup ? 'Creating account…' : 'Signing in…') : isSignup ? 'Create account' : 'Sign in'}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6 text-sm text-ink-3">
              <span className="h-px flex-1 bg-rule" />
              or
              <span className="h-px flex-1 bg-rule" />
            </div>

            <div className="space-y-2">
              <a href="/api/auth/google" className="btn btn-secondary w-full h-11">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </a>
              <button type="button" onClick={handleDemo} disabled={demoLoading} className="btn btn-ghost w-full h-11">
                {demoLoading ? 'Starting the demo…' : 'Try the demo, no account needed'}
              </button>
            </div>

            <p className="text-sm text-ink-2 mt-8">
              {isSignup ? 'Already have an account? ' : 'New here? '}
              <button type="button" onClick={switchMode} className="text-accent font-medium hover:underline cursor-pointer">
                {isSignup ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          </div>
        </div>
      </main>

      <aside className="hidden lg:flex flex-col justify-center bg-sunken border-l border-rule px-14">
        <div className="max-w-md">
          <p className="font-display text-[2rem] leading-tight font-semibold tracking-tight">
            Every hackathon you have signed up for, on one calendar.
          </p>
          <p className="mt-3 text-ink-2">
            See which deadlines overlap, how far each build has come, and who on the team owns what.
          </p>

          <div className="mt-10 bg-surface border border-rule rounded-2xl p-5" aria-hidden="true">
            <div className="relative space-y-3">
              <span className="absolute -top-1 -bottom-1 left-[52%] w-0.5 bg-highlight" />
              {previewBars.map((b) => (
                <div key={b.name}>
                  <div className="text-xs text-ink-3 mb-1" style={{ marginLeft: `${b.left}%` }}>
                    {b.name}
                  </div>
                  <div
                    className={`h-4 rounded-full overflow-hidden ${b.soft}`}
                    style={{ marginLeft: `${b.left}%`, width: `${b.width}%` }}
                  >
                    <div className={`h-full ${b.tone}`} style={{ width: `${b.fill}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
