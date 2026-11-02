import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { SOCIAL_PLATFORMS } from '@/lib/socialLinks';

interface Props {
  links: Record<string, string>;
  // Saves the changed fields; resolves to the saved links
  onSave: (changes: Record<string, string>) => Promise<Record<string, string>>;
  onToast: (title: string, message: string, type?: 'success' | 'alert' | 'info') => void;
}

/** One field per platform. A username or a full link both work; the server turns them into checked links */
export const ProfileLinksEditor: React.FC<Props> = ({ links, onSave, onToast }) => {
  const [draft, setDraft] = useState<Record<string, string>>(links);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);

  const changes = Object.fromEntries(
    SOCIAL_PLATFORMS.flatMap(({ id }) => ((draft[id] ?? '').trim() !== (links[id] ?? '') ? [[id, (draft[id] ?? '').trim()]] : []))
  );
  const changed = Object.keys(changes).length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFieldError(null);
    try {
      const saved = await onSave(changes);
      setDraft(saved);
      onToast('Links saved', 'They now show on your profile.');
    } catch (err) {
      const field = err instanceof ApiError ? (err.data.field as string | undefined) : undefined;
      if (field) setFieldError({ field, message: err instanceof Error ? err.message : 'Check this link.' });
      else onToast('Could not save links', err instanceof Error ? err.message : 'Try again.', 'alert');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="links-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
      <h2 id="links-heading" className="font-display text-lg font-semibold">
        Links
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        Your coding and hackathon profiles. Type a username or paste the full link. They show on your public profile.
      </p>
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map(({ id, label, placeholder }) => {
            const error = fieldError?.field === id ? fieldError.message : null;
            return (
              <div key={id}>
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor={`link-${id}`} className="field-label">
                    {label}
                  </label>
                  {links[id] && (
                    <a
                      href={links[id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline inline-flex items-center gap-0.5"
                      aria-label={`Open your ${label} link`}
                    >
                      Open <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <input
                  id={`link-${id}`}
                  value={draft[id] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [id]: e.target.value }))}
                  placeholder={placeholder}
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `link-${id}-error` : undefined}
                  className={`field ${error ? 'border-danger' : ''}`}
                />
                {error && (
                  <p id={`link-${id}-error`} className="mt-1 text-xs text-danger">
                    {error}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={!changed || saving}>
            {saving ? 'Saving…' : 'Save links'}
          </button>
          <span className="text-xs text-ink-3">Clear a field to remove that link.</span>
        </div>
      </form>
    </section>
  );
};
