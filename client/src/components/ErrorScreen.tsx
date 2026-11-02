import React, { useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, LogIn, RotateCw } from 'lucide-react';
import { Wordmark } from './Navbar';
import { ERROR_CODE, ERROR_COPY, errorKindOf, type ErrorKind } from '@/lib/errors';

interface Props {
  // Either the kind, or the error to work it out from
  kind?: ErrorKind;
  error?: unknown;
  // Wording for a specific thing, e.g. "Hackathon not found"
  title?: string;
  message?: string;
  // What "Try again" does; reloads the page when not given
  onRetry?: () => void;
  // 'page' fills the screen with its own header; 'inline' sits under a page's navbar
  variant?: 'page' | 'inline';
  home?: { to: string; label: string };
}

const RETRYABLE: ErrorKind[] = ['offline', 'unavailable', 'rate-limited', 'server'];

/** The timeline bars, knocked out of line: the app's motif in a broken state */
function BrokenBars({ kind }: { kind: ErrorKind }) {
  const tone = kind === 'not-found' || kind === 'forbidden' ? 'fill-ink-3' : 'fill-danger';
  return (
    <svg width="88" height="64" viewBox="0 0 88 64" aria-hidden="true" className="mx-auto">
      <rect x="4" y="6" width="44" height="12" rx="6" className="fill-accent" />
      <rect
        x="26"
        y="26"
        width="54"
        height="12"
        rx="6"
        className={kind === 'not-found' ? 'fill-none stroke-rule-strong' : tone}
        strokeWidth="2"
        strokeDasharray={kind === 'not-found' ? '6 5' : undefined}
        transform={kind === 'not-found' ? undefined : 'rotate(8 53 32)'}
      />
      <rect x="12" y="46" width="32" height="12" rx="6" className="fill-ink-3" />
    </svg>
  );
}

/** One screen for every kind of failure: missing pages, no access, signed out, offline, server errors and crashes */
export const ErrorScreen: React.FC<Props> = ({
  kind: givenKind,
  error,
  title,
  message,
  onRetry,
  variant = 'page',
  home = { to: '/dashboard', label: 'Go to your hackathons' },
}) => {
  const kind = givenKind ?? errorKindOf(error);
  const copy = ERROR_COPY[kind];
  const retry = onRetry ?? (() => window.location.reload());

  // Offline pages try again by themselves once the connection is back
  useEffect(() => {
    if (kind !== 'offline') return;
    const onOnline = () => (onRetry ? onRetry() : window.location.reload());
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [kind, onRetry]);

  const here = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/dashboard';
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1;
  const details = kind === 'crash' && error instanceof Error ? error : null;

  const body = (
    <div className="w-full max-w-lg mx-auto text-center py-12 sm:py-16 animate-rise">
      <BrokenBars kind={kind} />
      <p className="mt-6 font-display text-5xl sm:text-6xl font-semibold tracking-tight text-ink-3 tabular-nums">
        {ERROR_CODE[kind]}
      </p>
      <h1 className="mt-3 font-display text-2xl sm:text-3xl font-semibold tracking-tight">{title ?? copy.title}</h1>
      <p className="mt-3 text-ink-2 max-w-md mx-auto">{message ?? copy.message}</p>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {kind === 'session' ? (
          <Link to={`/login?next=${encodeURIComponent(here)}`} className="btn btn-primary">
            <LogIn className="w-4 h-4" />
            Sign in again
          </Link>
        ) : RETRYABLE.includes(kind) || kind === 'update' || kind === 'crash' ? (
          <button onClick={retry} className="btn btn-primary">
            <RotateCw className="w-4 h-4" />
            {kind === 'update' || kind === 'crash' ? 'Reload the page' : 'Try again'}
          </button>
        ) : null}
        {(kind === 'not-found' || kind === 'forbidden') && canGoBack && (
          <button onClick={() => window.history.back()} className="btn btn-secondary">
            <ArrowLeft className="w-4 h-4" />
            Go back
          </button>
        )}
        {kind !== 'session' && (
          <Link to={home.to} className={kind === 'not-found' || kind === 'forbidden' ? 'btn btn-primary' : 'btn btn-secondary'}>
            {home.label}
          </Link>
        )}
      </div>

      {kind === 'offline' && (
        <p className="mt-6 text-xs text-ink-3" role="status">
          Waiting for your connection…
        </p>
      )}

      {details && (
        <details className="mt-8 text-left bg-sunken rounded-xl px-4 py-3 text-sm">
          <summary className="cursor-pointer text-ink-2 font-medium">Technical details</summary>
          <p className="mt-2 font-mono text-xs text-ink break-words">{details.message}</p>
          {import.meta.env.DEV && details.stack && (
            <pre className="mt-2 text-[11px] text-ink-3 overflow-x-auto whitespace-pre-wrap">{details.stack}</pre>
          )}
        </details>
      )}
    </div>
  );

  if (variant === 'inline') return <main className="px-4 sm:px-6">{body}</main>;

  return (
    <div className="min-h-screen bg-paper flex flex-col px-4 sm:px-10 py-6 sm:py-8">
      <Link to="/dashboard" className="self-start rounded-md">
        <Wordmark />
      </Link>
      <main className="flex-1 flex items-center">{body}</main>
    </div>
  );
};

/** A compact error for one part of a page (a list that failed to load), with a retry button */
export const InlineError: React.FC<{ error: unknown; what: string; onRetry: () => void }> = ({ error, what, onRetry }) => {
  const kind = errorKindOf(error);
  const message = error instanceof Error ? error.message : ERROR_COPY[kind].message;
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 bg-danger-soft text-danger rounded-xl px-5 py-4">
      <p className="text-sm min-w-0">
        <span className="font-semibold">
          {kind === 'offline' ? "Can't reach HackTrack." : kind === 'unavailable' ? 'HackTrack is temporarily unavailable.' : `Could not load ${what}.`}
        </span>{' '}
        {message}
      </p>
      <button onClick={onRetry} className="btn btn-secondary text-sm py-1.5 shrink-0">
        <RotateCw className="w-3.5 h-3.5" />
        Try again
      </button>
    </div>
  );
};
