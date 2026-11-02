import React, { useEffect, useState } from 'react';
import { useNavigation } from 'react-router';
import { useDelayed } from '@/lib/useDelayed';

export const Spinner: React.FC<{ className?: string; label?: string }> = ({ className = 'w-4 h-4', label }) => (
  <span role={label ? 'status' : undefined} className="inline-flex items-center gap-2">
    <svg viewBox="0 0 24 24" className={`animate-spin text-accent ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
    {label && <span className="text-sm text-ink-2">{label}</span>}
  </span>
);

/** A grey placeholder block with a soft sweep */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton ${className}`} aria-hidden="true" />
);

/** The wordmark's bars pulsing: shown while the app itself starts */
export const AppLoading: React.FC = () => {
  const shown = useDelayed(150);
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      {shown && (
        <>
          <svg width="44" height="36" viewBox="0 0 22 18" aria-hidden="true">
            <rect x="0" y="1" width="12" height="4" rx="2" className="fill-accent animate-bar-load" />
            <rect x="5" y="7" width="15" height="4" rx="2" className="fill-ink animate-bar-load [animation-delay:0.15s]" />
            <rect x="2" y="13" width="9" height="4" rx="2" className="fill-ink-3 animate-bar-load [animation-delay:0.3s]" />
          </svg>
          <p className="text-sm text-ink-2">Loading Hackcrew…</p>
        </>
      )}
      {!shown && <span className="sr-only">Loading</span>}
    </div>
  );
};

/**
 * A thin bar along the top of the window while the app is waiting: moving between pages, loading a page's
 * code, or waiting on the server. It only appears when the wait is noticeable
 */
export const LoadingBar: React.FC = () => {
  const navigating = useNavigation().state !== 'idle';
  const [requests, setRequests] = useState(0);
  const [visible, setVisible] = useState(false);
  const busy = navigating || requests > 0;

  useEffect(() => {
    const onActivity = (e: Event) => setRequests((e as CustomEvent<number>).detail);
    window.addEventListener('api-activity', onActivity);
    return () => window.removeEventListener('api-activity', onActivity);
  }, []);

  useEffect(() => {
    // Show after a short wait; hide straight away when done
    const timer = setTimeout(() => setVisible(busy), busy ? 250 : 0);
    return () => clearTimeout(timer);
  }, [busy]);

  if (!visible) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[60] h-0.5 pointer-events-none" role="progressbar" aria-label="Loading">
      <div className="h-full bg-accent animate-progress shadow-[0_0_8px_var(--accent)]" />
    </div>
  );
};

type SkeletonLayout = 'list' | 'cards' | 'detail' | 'profile' | 'stats';

/** Placeholder content shaped like the page that is loading */
export const PageSkeleton: React.FC<{ layout?: SkeletonLayout; label?: string }> = ({ layout = 'list', label = 'Loading' }) => {
  const shown = useDelayed(200);
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}…</span>
      {shown && (
        <div className="animate-rise">
          {layout === 'list' && (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bg-surface border border-rule rounded-2xl px-5 py-4 flex items-center gap-4">
                  <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-6 w-20 hidden sm:block" />
                </div>
              ))}
            </div>
          )}
          {layout === 'cards' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-surface border border-rule rounded-2xl px-5 py-5 space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-full mt-4" />
                  <div className="flex gap-2 pt-3">
                    <Skeleton className="w-7 h-7 rounded-full" />
                    <Skeleton className="w-7 h-7 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {layout === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="bg-surface border border-rule rounded-2xl px-5 py-4 space-y-2">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-8 w-1/3" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-56 w-full rounded-2xl" />
            </div>
          )}
          {layout === 'detail' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-24 w-full rounded-2xl" />
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="space-y-6">
                  <Skeleton className="h-40 w-full rounded-2xl" />
                  <Skeleton className="h-64 w-full rounded-2xl" />
                </div>
                <div className="space-y-6">
                  <Skeleton className="h-48 w-full rounded-2xl" />
                  <Skeleton className="h-40 w-full rounded-2xl" />
                </div>
              </div>
            </div>
          )}
          {layout === 'profile' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-8 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
              </div>
              <Skeleton className="h-36 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
