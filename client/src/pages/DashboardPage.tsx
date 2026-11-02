import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { DeadlineTimeline } from '@/components/DeadlineTimeline';
import { HackathonRow } from '@/components/HackathonRow';
import { HackathonFormModal } from '@/components/HackathonFormModal';
import { ToastContainer } from '@/components/ToastContainer';
import { HackathonView, ToastMessage } from '@/lib/types';
import {
  clearBrowserSavedHackathons,
  getBrowserSavedHackathons,
} from '@/lib/mock-data';
import { api, conflictCopy } from '@/lib/api';
import { describeDeadline, daysUntil, generateId, isOverdue } from '@/lib/utils';
import { CalendarPlus, Plus } from 'lucide-react';
import { InlineError } from '@/components/ErrorScreen';
import { PageSkeleton } from '@/components/Loading';

type Filter = 'all' | 'in_progress' | 'done' | 'overdue' | 'high_priority';

const FILTERS: { id: Filter; label: string; test: (h: HackathonView) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'in_progress', label: 'In progress', test: (h) => h.status === 'in_progress' },
  { id: 'overdue', label: 'Overdue', test: isOverdue },
  { id: 'done', label: 'Submitted or done', test: (h) => h.status === 'submitted' || h.status === 'completed' },
  { id: 'high_priority', label: 'High priority', test: (h) => h.priority === 'high' },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Lets the header refresh notifications after deadlines or tasks change
const announceChange = () => window.dispatchEvent(new Event('hackathons-changed'));

const isFinished = (h: HackathonView) => h.status === 'submitted' || h.status === 'completed';

// Unfinished work first, soonest deadline first
const byUrgency = (a: HackathonView, b: HackathonView) => {
  if (isFinished(a) !== isFinished(b)) return isFinished(a) ? 1 : -1;
  const da = a.submissionDeadline ? new Date(a.submissionDeadline).getTime() : Infinity;
  const db = b.submissionDeadline ? new Date(b.submissionDeadline).getTime() : Infinity;
  return da - db;
};

export default function DashboardPage() {
  const [hackathons, setHackathons] = useState<HackathonView[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [browserSaved, setBrowserSaved] = useState<HackathonView[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingHackathon, setEditingHackathon] = useState<HackathonView | null>(null);

  // Load the account's hackathons, and check for any left in this browser by the old local-only version
  useEffect(() => {
    api
      .listHackathons()
      .then((list) => {
        setHackathons(list);
        setBrowserSaved(getBrowserSavedHackathons());
        setLoaded(true);
      })
      .catch(setLoadError);
  }, [reloadKey]);

  const addToast = (title: string, message: string, type: 'success' | 'alert' | 'info' = 'info') => {
    const id = `toast-${generateId()}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Please try again.');

  const handleCreateHackathon = async (draft: HackathonView) => {
    try {
      const created = await api.createHackathon(draft);
      setHackathons((prev) => [created, ...prev]);
      announceChange();
      addToast('Hackathon added', `${created.title} is now on your list.`, 'success');
    } catch (err) {
      addToast('Could not add hackathon', errorMessage(err), 'alert');
    }
  };

  const handleUpdateHackathon = async (updated: HackathonView) => {
    try {
      const saved = await api.updateHackathon(updated);
      setHackathons((prev) => prev.map((h) => (h.id === saved.id ? saved : h)));
      announceChange();
      addToast('Changes saved', `${saved.title} has been updated.`, 'success');
    } catch (err) {
      const latest = conflictCopy(err);
      if (latest) setHackathons((prev) => prev.map((h) => (h.id === latest.id ? latest : h)));
      addToast(latest ? 'Not saved: a teammate changed it' : 'Could not save changes', errorMessage(err), 'alert');
    }
  };

  // Adds either the hackathons saved in this browser or the server's sample set
  const importHackathons = async (list: HackathonView[] | 'samples', fromBrowser: boolean) => {
    setBusy(true);
    try {
      const added = list === 'samples' ? await api.loadSampleHackathons() : await api.importHackathons(list);
      setHackathons((prev) => [...added, ...prev]);
      announceChange();
      if (fromBrowser) {
        clearBrowserSavedHackathons();
        setBrowserSaved([]);
      }
      addToast(
        fromBrowser ? 'Hackathons imported' : 'Sample hackathons added',
        `${plural(added.length, 'hackathon')} added to your account.`,
        'success'
      );
    } catch (err) {
      addToast('Could not add hackathons', errorMessage(err), 'alert');
    } finally {
      setBusy(false);
    }
  };

  const handleDiscardBrowserSaved = () => {
    if (!confirm('Discard the hackathons saved in this browser? They will not be added to your account.')) return;
    clearBrowserSavedHackathons();
    setBrowserSaved([]);
  };

  const query = searchQuery.trim().toLowerCase();
  const matchesSearch = (h: HackathonView) =>
    !query ||
    [h.title, h.teamName, h.domain, h.code].some((field) => field.toLowerCase().includes(query));

  const searched = hackathons.filter(matchesSearch);
  const currentFilter = FILTERS.find((f) => f.id === activeFilter) ?? FILTERS[0];
  const visible = searched.filter(currentFilter.test).sort(byUrgency);

  // Summary line
  const upcoming = hackathons
    .filter((h) => !isFinished(h) && (daysUntil(h.submissionDeadline) ?? -1) >= 0)
    .sort(byUrgency);
  const overdueCount = hackathons.filter(isOverdue).length;
  const activeCount = hackathons.filter((h) => !isFinished(h)).length;

  return (
    <div className="min-h-screen bg-paper">
      <Navbar
        onAddHackathon={() => setIsNewModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Your hackathons</h1>
          {loaded && (
            <p className="mt-2 text-ink-2">
              {hackathons.length === 0
                ? 'Add the hackathons you have registered for to track their deadlines, tasks and teams.'
                : [
                    `${activeCount} of ${hackathons.length} still need work.`,
                    upcoming[0]
                      ? `Next up is ${upcoming[0].title}, ${describeDeadline(upcoming[0].submissionDeadline).toLowerCase()}.`
                      : 'Nothing has an upcoming deadline.',
                    overdueCount > 0
                      ? `${overdueCount} ${overdueCount === 1 ? 'is' : 'are'} past the deadline without a submission.`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
            </p>
          )}
        </div>

        {loadError !== null && (
          <InlineError
            error={loadError}
            what="your hackathons"
            onRetry={() => {
              setLoadError(null);
              setReloadKey((k) => k + 1);
            }}
          />
        )}
        {!loaded && loadError === null && <PageSkeleton layout="list" label="Loading your hackathons" />}

        {loaded && browserSaved.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-accent-soft rounded-xl px-5 py-4">
            <p className="text-sm text-ink">
              {plural(browserSaved.length, 'hackathon')} {browserSaved.length === 1 ? 'is' : 'are'} saved in this
              browser from before you had an account. Import {browserSaved.length === 1 ? 'it' : 'them'} so{' '}
              {browserSaved.length === 1 ? 'it is' : 'they are'} stored in your account.
            </p>
            <div className="flex gap-2">
              <button onClick={handleDiscardBrowserSaved} className="btn btn-ghost" disabled={busy}>
                Discard
              </button>
              <button onClick={() => importHackathons(browserSaved, true)} className="btn btn-primary" disabled={busy}>
                Import {plural(browserSaved.length, 'hackathon')}
              </button>
            </div>
          </div>
        )}

        <DeadlineTimeline hackathons={hackathons} />

        {loaded && hackathons.length === 0 ? (
          <div className="border border-dashed border-rule-strong rounded-2xl px-6 py-14 text-center">
            <p className="font-display text-xl font-semibold">No hackathons yet</p>
            <p className="mt-1 text-ink-2 text-sm">Add one to see it on your schedule, or load a few samples to try things out.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button onClick={() => setIsNewModalOpen(true)} className="btn btn-primary">
                <Plus className="w-4 h-4" />
                Add hackathon
              </button>
              <button
                onClick={() => importHackathons('samples', false)}
                className="btn btn-secondary"
                disabled={busy}
              >
                Load sample hackathons
              </button>
            </div>
          </div>
        ) : (
          loaded && (
            <section aria-labelledby="list-heading" className="bg-surface border border-rule rounded-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-rule">
                <div className="flex items-baseline gap-3">
                  <h2 id="list-heading" className="font-display text-lg font-semibold">
                    All hackathons
                  </h2>
                  <a
                    href={api.calendarUrl()}
                    className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                    title="Download every key date as a calendar file for Google Calendar, Outlook or Apple Calendar"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    Export deadlines
                  </a>
                </div>
                <div role="tablist" aria-label="Filter hackathons" className="flex flex-wrap gap-1">
                  {FILTERS.map((f) => {
                    const count = searched.filter(f.test).length;
                    const isActive = activeFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveFilter(f.id)}
                        className={`px-3 h-8 rounded-lg text-sm transition-colors cursor-pointer ${
                          isActive ? 'bg-ink text-paper font-medium' : 'text-ink-2 hover:bg-sunken'
                        }`}
                      >
                        {f.label}
                        <span className={`ml-1.5 tabular-nums ${isActive ? 'opacity-70' : 'text-ink-3'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {visible.length > 0 ? (
                <>
                  <div className="hidden md:grid grid-cols-[minmax(0,1fr)_8rem_9rem_10rem_2.25rem] gap-x-4 px-5 py-2 text-xs text-ink-3 border-b border-rule">
                    <span>Hackathon</span>
                    <span>Status</span>
                    <span>Tasks done</span>
                    <span>Deadline</span>
                    <span />
                  </div>
                  <ul className="divide-y divide-rule">
                    {visible.map((h) => (
                      <HackathonRow key={h.id} hackathon={h} onEdit={setEditingHackathon} />
                    ))}
                  </ul>
                </>
              ) : (
                <div className="px-6 py-12 text-center">
                  <p className="font-medium">Nothing matches</p>
                  <p className="mt-1 text-sm text-ink-2">
                    {query ? `No hackathon in this view matches "${searchQuery}".` : 'No hackathons in this view.'}
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setActiveFilter('all');
                    }}
                    className="btn btn-secondary mt-4"
                  >
                    Show all hackathons
                  </button>
                </div>
              )}
            </section>
          )
        )}
      </main>

      <HackathonFormModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleCreateHackathon}
      />

      <HackathonFormModal
        isOpen={editingHackathon !== null}
        hackathon={editingHackathon}
        onClose={() => setEditingHackathon(null)}
        onSubmit={handleUpdateHackathon}
      />

      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
}
