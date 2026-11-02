import React from 'react';
import { Link } from 'react-router';
import { ExternalLink, KanbanSquare } from 'lucide-react';
import { ProfileProject } from '@/lib/types';
import { PROJECT_STATUS_META } from '@/lib/project';

interface Props {
  projects: ProfileProject[];
  // Settings mode: links to the project and a switch to show it on the public page
  onToggleShown?: (id: string, shown: boolean) => void;
}

export const ProfileProjectList: React.FC<Props> = ({ projects, onToggleShown }) => (
  <ul className="divide-y divide-rule">
    {projects.map((p) => {
      const meta = PROJECT_STATUS_META[p.status];
      return (
        <li key={p.id} className={`py-4 flex gap-4 ${onToggleShown && !p.shown ? 'opacity-60' : ''}`}>
          <span
            className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              p.status === 'shipped' ? 'bg-ok-soft text-ok' : 'bg-sunken text-ink-3'
            }`}
            aria-hidden="true"
          >
            <KanbanSquare className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              {onToggleShown ? (
                <Link to={`/projects/${p.id}`} className="font-medium text-ink hover:text-accent">
                  {p.title}
                </Link>
              ) : (
                <h3 className="font-medium text-ink">{p.title}</h3>
              )}
              <span className={`text-xs font-medium rounded-md px-2 py-0.5 ${meta.badge}`}>
                {meta.label}
                {p.status !== 'shipped' && p.progress > 0 && `, ${p.progress}%`}
              </span>
            </div>
            {p.tagline && <p className="text-sm text-ink-2">{p.tagline}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-accent-soft text-accent font-medium">{p.position}</span>
              {p.hackathonTitle && <span className="px-2 py-0.5 rounded-md bg-sunken text-ink-2">Built for {p.hackathonTitle}</span>}
              {p.techStack.slice(0, 6).map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-md border border-rule text-ink-2">
                  {t}
                </span>
              ))}
            </div>
            {(p.repoUrl || p.demoUrl) && (
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                {p.demoUrl && (
                  <a href={p.demoUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-accent hover:underline">
                    Live demo <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {p.repoUrl && (
                  <a href={p.repoUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-accent hover:underline">
                    Code <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>
          {onToggleShown && (
            <label className="shrink-0 flex items-start gap-2 text-xs text-ink-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={Boolean(p.shown)}
                onChange={(e) => onToggleShown(p.id, e.target.checked)}
                className="w-4 h-4 accent-[var(--accent)]"
              />
              <span className="hidden sm:inline">Show publicly</span>
              <span className="sr-only sm:hidden">Show {p.title} on your public profile</span>
            </label>
          )}
        </li>
      );
    })}
  </ul>
);
