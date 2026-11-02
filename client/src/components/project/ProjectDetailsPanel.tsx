import React from 'react';
import { Link } from 'react-router';
import { ExternalLink, Trophy } from 'lucide-react';
import { ProjectView } from '@/lib/types';
import { dueLabel } from '@/lib/project';
import { formatShortDate } from '@/lib/utils';

const LINKS: { key: keyof ProjectView['links']; label: string }[] = [
  { key: 'repoUrl', label: 'Code' },
  { key: 'demoUrl', label: 'Live demo' },
  { key: 'videoUrl', label: 'Demo video' },
  { key: 'deckUrl', label: 'Pitch deck' },
];

interface Props {
  project: ProjectView;
  now: number;
  onEdit: () => void;
}

/** About, tech stack, links, dates and the linked hackathon */
export const ProjectDetailsPanel: React.FC<Props> = ({ project, now, onEdit }) => {
  const links = LINKS.filter((l) => project.links[l.key]);
  const finished = project.status === 'shipped' || project.status === 'archived';
  return (
    <section aria-labelledby="details-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="details-heading" className="font-display text-lg font-semibold">
          About
        </h2>
        <button onClick={onEdit} className="text-sm text-accent hover:underline">
          Edit
        </button>
      </div>

      {project.description ? (
        <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{project.description}</p>
      ) : (
        <p className="text-sm text-ink-3">No description yet. Add what it does and how it works.</p>
      )}

      {project.hackathon && (
        <div className="flex items-center gap-2 text-sm">
          <Trophy className="w-4 h-4 text-ink-3 shrink-0" aria-hidden="true" />
          {project.hackathon.canOpen ? (
            <Link to={`/dashboard/hackathons/${project.hackathon.id}`} className="text-accent hover:underline truncate">
              {project.hackathon.title}
            </Link>
          ) : (
            <span className="truncate">{project.hackathon.title}</span>
          )}
          <span className="text-ink-3 shrink-0">· team {project.hackathon.teamName}</span>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-ink-3 text-xs">Started</dt>
          <dd className="tabular-nums">{project.startDate ? formatShortDate(project.startDate) : 'Not set'}</dd>
        </div>
        <div>
          <dt className="text-ink-3 text-xs">Target</dt>
          <dd className="tabular-nums">
            {project.targetDate ? formatShortDate(project.targetDate) : 'Not set'}
            {project.targetDate && !finished && (
              <span
                className={`block text-xs ${Date.parse(project.targetDate) < now ? 'text-danger font-medium' : 'text-ink-3'}`}
              >
                {dueLabel(project.targetDate, now)}
              </span>
            )}
          </dd>
        </div>
      </dl>

      {project.techStack.length > 0 && (
        <div>
          <h3 className="text-xs text-ink-3 mb-1.5">Tech stack</h3>
          <ul className="flex flex-wrap gap-1.5">
            {project.techStack.map((t) => (
              <li key={t} className="text-xs px-2 py-0.5 rounded-md bg-sunken text-ink-2">
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-xs text-ink-3 mb-1.5">Links</h3>
        {links.length ? (
          <ul className="flex flex-wrap gap-2">
            {links.map((l) => (
              <li key={l.key}>
                <a
                  href={project.links[l.key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm px-2.5 py-1 rounded-lg border border-rule hover:border-accent hover:text-accent transition-colors"
                >
                  {l.label}
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">Add the repository, demo, video and deck under Edit.</p>
        )}
      </div>
    </section>
  );
};
