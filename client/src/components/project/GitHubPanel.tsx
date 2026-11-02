import React from 'react';
import { ExternalLink, GitCommitHorizontal, GitPullRequest, RefreshCw, Star } from 'lucide-react';
import { GitHubPull, ProjectView } from '@/lib/types';
import { timeAgo } from '@/lib/project';

interface Props {
  project: ProjectView;
  now: number;
  syncing: boolean;
  onSync: () => void;
  onEdit: () => void;
}

const PULL_STATE: Record<GitHubPull['state'], { label: string; tone: string }> = {
  open: { label: 'Open', tone: 'bg-ok-soft text-ok' },
  merged: { label: 'Merged', tone: 'bg-accent-soft text-accent' },
  closed: { label: 'Closed', tone: 'bg-sunken text-ink-3' },
};

/** Latest commits and pull requests from the project's public GitHub repository */
export const GitHubPanel: React.FC<Props> = ({ project, now, syncing, onSync, onEdit }) => {
  const gh = project.github;

  if (!gh) {
    return (
      <section aria-labelledby="github-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
        <h2 id="github-heading" className="font-display text-lg font-semibold">
          GitHub
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          Add the project's public GitHub repository as its code link to see recent commits and pull requests here. Link a
          card to a pull request and it moves to Done when the pull request is merged.
        </p>
        <button onClick={onEdit} className="btn btn-secondary text-sm mt-3">
          Add repository link
        </button>
      </section>
    );
  }

  // Open pull requests, then ones merged or closed in the last two weeks
  const pulls = gh.pulls
    .filter((p) => p.state === 'open' || now - Date.parse(p.updatedAt) <= 14 * 24 * 60 * 60 * 1000)
    .slice(0, 8);
  const cardFor = (n: number) => project.tasks.find((t) => t.pullRequest === n);

  return (
    <section aria-labelledby="github-heading" className="bg-surface border border-rule rounded-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <h2 id="github-heading" className="font-display text-lg font-semibold">
            GitHub
          </h2>
          <a
            href={gh.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-accent hover:underline break-all"
          >
            {gh.repo}
            <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          {gh.syncedAt && <span className="text-xs text-ink-3">Updated {timeAgo(gh.syncedAt, now)}</span>}
          <button onClick={onSync} disabled={syncing} className="btn btn-secondary text-sm py-1" aria-label="Refresh from GitHub">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {gh.error && (
        <p role="alert" className="mx-5 mb-3 px-3 py-2 rounded-lg bg-warn-soft text-warn text-sm">
          {gh.error}
        </p>
      )}
      {!gh.info && !gh.error && <p className="px-5 pb-5 text-sm text-ink-3">{syncing ? 'Reading the repository…' : 'Not read yet.'}</p>}

      {gh.info && (
        <>
          <dl className="px-5 pb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
            <div className="inline-flex items-center gap-1">
              <dt className="sr-only">Stars</dt>
              <Star className="w-3.5 h-3.5" aria-hidden="true" />
              <dd className="tabular-nums">{gh.info.stars}</dd>
            </div>
            {gh.info.language && (
              <div>
                <dt className="sr-only">Language</dt>
                <dd>{gh.info.language}</dd>
              </div>
            )}
            <div>
              <dt className="inline">Branch </dt>
              <dd className="inline font-medium text-ink">{gh.info.defaultBranch}</dd>
            </div>
            {gh.info.pushedAt && (
              <div>
                <dt className="inline">Last push </dt>
                <dd className="inline font-medium text-ink">{timeAgo(gh.info.pushedAt, now)}</dd>
              </div>
            )}
          </dl>

          <div className="grid gap-0 md:grid-cols-2 border-t border-rule">
            <div className="px-5 py-4 md:border-r md:border-rule min-w-0">
              <h3 className="text-sm font-semibold">Latest commits</h3>
              {gh.commits.length === 0 ? (
                <p className="mt-2 text-sm text-ink-3">No commits yet.</p>
              ) : (
                <ul className="mt-2 space-y-2.5">
                  {gh.commits.slice(0, 6).map((c) => (
                    <li key={c.sha} className="flex gap-2 min-w-0">
                      <GitCommitHorizontal className="w-4 h-4 text-ink-3 shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="min-w-0">
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="block text-sm truncate hover:text-accent">
                          {c.message}
                        </a>
                        <p className="text-xs text-ink-3">
                          <code>{c.sha}</code> · {c.author}
                          {c.date && ` · ${timeAgo(c.date, now)}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-5 py-4 border-t md:border-t-0 border-rule min-w-0">
              <h3 className="text-sm font-semibold">Pull requests</h3>
              {pulls.length === 0 ? (
                <p className="mt-2 text-sm text-ink-3">No open or recent pull requests.</p>
              ) : (
                <ul className="mt-2 space-y-2.5">
                  {pulls.map((p) => {
                    const card = cardFor(p.number);
                    return (
                      <li key={p.number} className="flex gap-2 min-w-0">
                        <GitPullRequest className="w-4 h-4 text-ink-3 shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="block text-sm truncate hover:text-accent">
                            #{p.number} {p.title}
                          </a>
                          <p className="text-xs text-ink-3 truncate">
                            {p.author} · {timeAgo(p.updatedAt, now)}
                            {card && <span className="text-ink-2"> · card “{card.title}”</span>}
                          </p>
                        </div>
                        <span className={`text-[11px] font-medium rounded px-1.5 py-0.5 h-fit shrink-0 ${PULL_STATE[p.state].tone}`}>
                          {PULL_STATE[p.state].label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-xs text-ink-3">Open a card and pick its pull request; the card moves to Done when it is merged.</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
