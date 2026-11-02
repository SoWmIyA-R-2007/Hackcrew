import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { ReminderSettings } from '@/lib/types';

const DAY_OPTIONS = [14, 7, 3, 1];

interface Props {
  reminders: ReminderSettings;
  hasDeadline: boolean;
  canEmail: boolean;
  onSave: (reminders: ReminderSettings) => Promise<boolean>;
  onEmailTeam: (note: string) => Promise<boolean>;
}

const dayLabel = (d: number) => (d === 1 ? '1 day' : `${d} days`);

export const RemindersPanel: React.FC<Props> = ({ reminders, hasDeadline, canEmail, onSave, onEmailTeam }) => {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [composing, setComposing] = useState(false);

  const toggleDay = (d: number) => {
    const days = reminders.daysBefore.includes(d)
      ? reminders.daysBefore.filter((x) => x !== d)
      : [...reminders.daysBefore, d].sort((a, b) => b - a);
    onSave({ ...reminders, daysBefore: days });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    if (await onEmailTeam(note.trim())) {
      setNote('');
      setComposing(false);
    }
    setSending(false);
  };

  return (
    <section aria-labelledby="reminders-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
      <h2 id="reminders-heading" className="font-display text-lg font-semibold">
        Reminders
      </h2>

      <label className="mt-3 flex items-center justify-between gap-3 text-sm cursor-pointer">
        <span className="text-ink">Email the team before the deadline</span>
        <input
          type="checkbox"
          checked={reminders.enabled}
          onChange={(e) => onSave({ ...reminders, enabled: e.target.checked })}
          className="w-4 h-4 accent-[var(--accent)]"
        />
      </label>

      {reminders.enabled && (
        <fieldset className="mt-3">
          <legend className="text-xs text-ink-3 mb-2">Send a reminder this long before the submission deadline</legend>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((d) => {
              const on = reminders.daysBefore.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  aria-pressed={on}
                  className={`px-3 h-8 rounded-lg text-sm border transition-colors cursor-pointer ${
                    on ? 'bg-accent-soft border-accent text-accent font-medium' : 'border-rule-strong text-ink-2 hover:bg-sunken'
                  }`}
                >
                  {dayLabel(d)}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-3">
            {!hasDeadline
              ? 'Set a submission deadline to start reminders.'
              : reminders.daysBefore.length === 0
                ? 'Pick at least one reminder.'
                : 'Reminders go to everyone on the team who has joined with an account, and stop once it is submitted.'}
          </p>
        </fieldset>
      )}

      <div className="mt-4 pt-4 border-t border-rule">
        {!canEmail ? (
          <p className="text-xs text-ink-3">Demo accounts cannot send email.</p>
        ) : composing ? (
          <form onSubmit={handleSend} className="space-y-2">
            <label htmlFor="team-note" className="field-label">
              Note for the team (optional)
            </label>
            <textarea
              id="team-note"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Demo video is the last blocker, can someone take it tonight?"
              className="field resize-y"
            />
            <p className="text-xs text-ink-3">The email also includes progress, open tasks and missing submission links.</p>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={sending}>
                <Send className="w-4 h-4" />
                {sending ? 'Sending…' : 'Send update'}
              </button>
              <button type="button" onClick={() => setComposing(false)} className="btn btn-ghost">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setComposing(true)} className="btn btn-secondary w-full">
            <Send className="w-4 h-4" />
            Email the team a status update
          </button>
        )}
      </div>
    </section>
  );
};
