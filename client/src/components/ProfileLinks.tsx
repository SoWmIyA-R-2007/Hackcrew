import React from 'react';
import { ExternalLink } from 'lucide-react';
import { SOCIAL_PLATFORMS } from '@/lib/socialLinks';

/** Profile links as labelled chips, in the platform order */
export const ProfileLinks: React.FC<{ links: Record<string, string> }> = ({ links }) => {
  const items = SOCIAL_PLATFORMS.filter((p) => links[p.id]);
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Profile links">
      {items.map(({ id, label }) => (
        <li key={id}>
          <a
            href={links[id]}
            target="_blank"
            rel="me noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule-strong bg-surface px-3 h-8 text-sm text-ink hover:border-accent hover:text-accent transition-colors"
          >
            {label}
            <ExternalLink className="w-3.5 h-3.5 text-ink-3" />
          </a>
        </li>
      ))}
    </ul>
  );
};
