import React, { useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { SubmissionLinks } from '@/lib/types';
import { SUBMISSION_FIELDS as FIELDS, submissionReadiness } from '@/lib/hackathon';

interface Props {
  links: SubmissionLinks;
  onSave: (links: SubmissionLinks) => Promise<boolean>;
}

export const SubmissionChecklist: React.FC<Props> = ({ links, onSave }) => {
  const [draft, setDraft] = useState<SubmissionLinks>(links);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const { done, total, ready } = submissionReadiness(links);
  const changed = FIELDS.some((f) => draft[f.key].trim() !== links[f.key]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const trimmed = Object.fromEntries(FIELDS.map((f) => [f.key, draft[f.key].trim()])) as unknown as SubmissionLinks;
    if (await onSave(trimmed)) setEditing(false);
    setSaving(false);
  };

  return (
    <section aria-labelledby="submission-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="submission-heading" className="font-display text-lg font-semibold">
          Submission checklist
        </h2>
        <span className={`text-sm ${ready ? 'text-ok font-medium' : 'text-ink-3'}`}>
          {ready ? 'Ready to submit' : `${done} of ${total} added`}
        </span>
      </div>

      {!editing ? (
        <>
          <ul className="mt-3 text-sm divide-y divide-rule">
            {FIELDS.map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-4 py-2.5">
                <span className="flex items-center gap-2 text-ink">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      links[f.key] ? 'bg-ok text-white' : 'border border-dashed border-rule-strong'
                    }`}
                    aria-hidden="true"
                  >
                    {links[f.key] && <Check className="w-3 h-3" strokeWidth={3} />}
                  </span>
                  {f.label}
                </span>
                {links[f.key] ? (
                  <a
                    href={links[f.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline inline-flex items-center gap-1 min-w-0"
                  >
                    <span className="truncate max-w-48">{links[f.key].replace(/^https?:\/\//, '')}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                ) : (
                  <span className="text-ink-3">Not added</span>
                )}
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              setDraft(links);
              setEditing(true);
            }}
            className="btn btn-secondary mt-3"
          >
            {done ? 'Edit links' : 'Add links'}
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`sub-${f.key}`} className="field-label">
                {f.label}
              </label>
              <input
                id={`sub-${f.key}`}
                type="url"
                value={draft[f.key]}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="field"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={!changed || saving}>
              {saving ? 'Saving…' : 'Save links'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
