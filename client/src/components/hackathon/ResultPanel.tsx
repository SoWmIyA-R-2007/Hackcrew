import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { HackathonOutcome, HackathonResult } from '@/lib/types';
import { OUTCOME_LABEL } from '@/lib/hackathon';

interface Props {
  result: HackathonResult;
  onSave: (result: HackathonResult) => Promise<boolean>;
}

export const ResultPanel: React.FC<Props> = ({ result, onSave }) => {
  const [draft, setDraft] = useState<HackathonResult>(result);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (await onSave(draft)) setEditing(false);
    setSaving(false);
  };

  return (
    <section aria-labelledby="result-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="result-heading" className="font-display text-lg font-semibold">
          Result
        </h2>
        {!editing && (
          <button
            onClick={() => {
              setDraft(result);
              setEditing(true);
            }}
            className="btn btn-ghost text-sm"
          >
            {result.outcome === 'pending' ? 'Record the result' : 'Edit'}
          </button>
        )}
      </div>

      {!editing ? (
        <div className="mt-3 flex gap-3">
          <span
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              result.outcome === 'winner' ? 'bg-highlight text-highlight-ink' : 'bg-sunken text-ink-3'
            }`}
            aria-hidden="true"
          >
            <Trophy className="w-5 h-5" />
          </span>
          <div className="text-sm min-w-0">
            <p className="font-medium text-ink">
              {OUTCOME_LABEL[result.outcome]}
              {result.placement && `: ${result.placement}`}
            </p>
            {result.prize && <p className="text-ink-2">Prize: {result.prize}</p>}
            {result.notes && <p className="text-ink-2 mt-1 whitespace-pre-line">{result.notes}</p>}
            {result.outcome === 'pending' && !result.notes && (
              <p className="text-ink-3">Record how it went once results are out. It feeds your stats.</p>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="result-outcome" className="field-label">
                Outcome
              </label>
              <select
                id="result-outcome"
                value={draft.outcome}
                onChange={(e) => setDraft((d) => ({ ...d, outcome: e.target.value as HackathonOutcome }))}
                className="field"
              >
                {(Object.keys(OUTCOME_LABEL) as HackathonOutcome[]).map((o) => (
                  <option key={o} value={o}>
                    {OUTCOME_LABEL[o]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="result-placement" className="field-label">
                Placement or award
              </label>
              <input
                id="result-placement"
                value={draft.placement}
                maxLength={100}
                onChange={(e) => setDraft((d) => ({ ...d, placement: e.target.value }))}
                placeholder="2nd place, Best use of AI"
                className="field"
              />
            </div>
          </div>
          <div>
            <label htmlFor="result-prize" className="field-label">
              Prize
            </label>
            <input
              id="result-prize"
              value={draft.prize}
              maxLength={200}
              onChange={(e) => setDraft((d) => ({ ...d, prize: e.target.value }))}
              placeholder="$1,000 and cloud credits"
              className="field"
            />
          </div>
          <div>
            <label htmlFor="result-notes" className="field-label">
              Notes
            </label>
            <textarea
              id="result-notes"
              rows={3}
              maxLength={2000}
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Judge feedback, what to do differently next time"
              className="field resize-y"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save result'}
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
