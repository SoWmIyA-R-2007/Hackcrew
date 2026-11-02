import React, { useEffect, useState } from 'react';
import { HackathonView, HackathonPriority, HackathonMode, HackathonStatus } from '@/lib/types';
import { X } from 'lucide-react';
import { generateCode, generateId, toDateTimeLocal } from '@/lib/utils';

interface HackathonFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (hackathon: HackathonView) => void;
  // When provided, the modal edits this hackathon instead of creating a new one
  hackathon?: HackathonView | null;
}

const DOMAIN_OPTIONS = [
  'Artificial Intelligence',
  'Infrastructure',
  'Cybersecurity',
  'Web3 & Crypto',
  'ClimateTech',
  'FinTech',
];

const STATUS_OPTIONS: { value: HackathonStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'completed', label: 'Completed' },
];

export const HackathonFormModal: React.FC<HackathonFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  hackathon,
}) => {
  if (!isOpen) return null;

  // Keyed so the form state resets whenever a different hackathon is opened
  return (
    <HackathonForm
      key={hackathon?.id ?? 'new'}
      hackathon={hackathon ?? null}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
};

interface HackathonFormProps {
  hackathon: HackathonView | null;
  onClose: () => void;
  onSubmit: (hackathon: HackathonView) => void;
}

const HackathonForm: React.FC<HackathonFormProps> = ({ hackathon, onClose, onSubmit }) => {
  const isEdit = hackathon !== null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [title, setTitle] = useState(hackathon?.title ?? '');
  const [teamName, setTeamName] = useState(hackathon?.teamName ?? '');
  const [domain, setDomain] = useState(hackathon?.domain ?? 'Artificial Intelligence');
  const [psId, setPsId] = useState(hackathon?.psId ?? '');
  const [problemStatement, setProblemStatement] = useState(hackathon?.problemStatement ?? '');
  const [mode, setMode] = useState<HackathonMode>(hackathon?.mode ?? 'online');
  const [priority, setPriority] = useState<HackathonPriority>(hackathon?.priority ?? 'medium');
  const [status, setStatus] = useState<HackathonStatus>(hackathon?.status ?? 'in_progress');
  const [kickoffDate, setKickoffDate] = useState(toDateTimeLocal(hackathon?.kickoffDate ?? null));
  const [submissionDeadline, setSubmissionDeadline] = useState(
    toDateTimeLocal(hackathon?.submissionDeadline ?? null)
  );
  const [registrationDeadline, setRegistrationDeadline] = useState(
    toDateTimeLocal(hackathon?.registrationDeadline ?? null)
  );
  const [shortlistDate, setShortlistDate] = useState(toDateTimeLocal(hackathon?.shortlistDate ?? null));
  const [finalPresentationDate, setFinalPresentationDate] = useState(
    toDateTimeLocal(hackathon?.finalPresentationDate ?? null)
  );
  const [websiteLink, setWebsiteLink] = useState(hackathon?.websiteLink ?? '');

  const toIso = (value: string) => (value ? new Date(value).toISOString() : null);

  // Keep a custom domain selectable when editing a hackathon created with one
  const domainOptions = DOMAIN_OPTIONS.includes(domain) ? DOMAIN_OPTIONS : [domain, ...DOMAIN_OPTIONS];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !teamName.trim()) return;

    const details = {
      title: title.trim(),
      teamName: teamName.trim(),
      domain: domain.trim(),
      psId: psId.trim() || hackathon?.psId || `PS-${Math.floor(10 + Math.random() * 90)}`,
      problemStatement: problemStatement.trim() || 'No problem statement provided.',
      status,
      priority,
      mode,
      kickoffDate: kickoffDate ? new Date(kickoffDate).toISOString() : new Date().toISOString(),
      submissionDeadline: toIso(submissionDeadline),
      registrationDeadline: toIso(registrationDeadline),
      shortlistDate: toIso(shortlistDate),
      finalPresentationDate: toIso(finalPresentationDate),
      websiteLink: websiteLink.trim() || null,
    };

    if (hackathon) {
      onSubmit({ ...hackathon, ...details });
      onClose();
      return;
    }

    const id = generateId();
    const code = generateCode(id);

    const newHackathon: HackathonView = {
      id,
      code,
      ...details,
      completion: 0,
      timeRemaining: submissionDeadline ? 'Active' : 'No deadline',
      bannerImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
      // The server adds the creator to the team as its lead
      operatives: [],
      tasks: [
        {
          id: `t-init-1`,
          title: 'Read the problem statement and judging criteria',
          completed: false,
          weight: 1,
          assigneeId: null,
          assigneeName: 'Unassigned',
          assigneeAvatar: '',
          dueDate: null,
        },
        {
          id: `t-init-2`,
          title: 'Set up the repository and project structure',
          completed: false,
          weight: 2,
          assigneeId: null,
          assigneeName: 'Unassigned',
          assigneeAvatar: '',
          dueDate: null,
        },
      ],
      submission: { repoUrl: '', demoVideoUrl: '', deckUrl: '', projectUrl: '' },
      result: { outcome: 'pending', placement: '', prize: '', notes: '' },
      reminders: { enabled: true, daysBefore: [7, 3, 1] },
    };

    onSubmit(newHackathon);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <button className="fixed inset-0 bg-scrim cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hackathon-form-heading"
        className="relative bg-paper border border-rule rounded-2xl w-full max-w-2xl my-auto animate-rise shadow-2xl shadow-ink/20"
      >
        <div className="flex items-center justify-between px-6 h-16 border-b border-rule">
          <h2 id="hackathon-form-heading" className="font-display text-xl font-semibold">
            {isEdit ? 'Edit hackathon' : 'Add a hackathon'}
          </h2>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-ink mb-3">The event</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="hf-title" className="field-label">Hackathon name</label>
                <input
                  id="hf-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Global AI Challenge 2026"
                  className="field"
                />
              </div>
              <div>
                <label htmlFor="hf-team" className="field-label">Your team name</label>
                <input
                  id="hf-team"
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="BlockMasters"
                  className="field"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="hf-domain" className="field-label">Track</label>
                <select id="hf-domain" value={domain} onChange={(e) => setDomain(e.target.value)} className="field">
                  {domainOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="hf-mode" className="field-label">Format</label>
                <select
                  id="hf-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as HackathonMode)}
                  className="field"
                >
                  <option value="online">Online</option>
                  <option value="offline">In person</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div>
                <label htmlFor="hf-link" className="field-label">Event website</label>
                <input
                  id="hf-link"
                  type="url"
                  value={websiteLink}
                  onChange={(e) => setWebsiteLink(e.target.value)}
                  placeholder="https://…"
                  className="field"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4 pt-6 border-t border-rule">
            <legend className="text-sm font-semibold text-ink mb-3 float-left w-full">Problem statement</legend>
            <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-4 clear-both">
              <div>
                <label htmlFor="hf-psid" className="field-label">ID</label>
                <input
                  id="hf-psid"
                  type="text"
                  value={psId}
                  onChange={(e) => setPsId(e.target.value)}
                  placeholder="PS-AI-04"
                  className="field"
                />
              </div>
              <div>
                <label htmlFor="hf-ps" className="field-label">Description</label>
                <textarea
                  id="hf-ps"
                  rows={3}
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  placeholder="What the organisers are asking you to build, and how it will be judged"
                  className="field resize-y"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4 pt-6 border-t border-rule">
            <legend className="text-sm font-semibold text-ink mb-3 float-left w-full">Dates and progress</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 clear-both">
              <div>
                <label htmlFor="hf-kickoff" className="field-label">Kickoff</label>
                <input
                  id="hf-kickoff"
                  type="datetime-local"
                  value={kickoffDate}
                  onChange={(e) => setKickoffDate(e.target.value)}
                  className="field tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="hf-deadline" className="field-label">Submission deadline</label>
                <input
                  id="hf-deadline"
                  type="datetime-local"
                  value={submissionDeadline}
                  onChange={(e) => setSubmissionDeadline(e.target.value)}
                  className="field tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="hf-registration" className="field-label">Registration closes (optional)</label>
                <input
                  id="hf-registration"
                  type="datetime-local"
                  value={registrationDeadline}
                  onChange={(e) => setRegistrationDeadline(e.target.value)}
                  className="field tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="hf-shortlist" className="field-label">Shortlist announced (optional)</label>
                <input
                  id="hf-shortlist"
                  type="datetime-local"
                  value={shortlistDate}
                  onChange={(e) => setShortlistDate(e.target.value)}
                  className="field tabular-nums"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="hf-final" className="field-label">Final presentation (optional)</label>
                <input
                  id="hf-final"
                  type="datetime-local"
                  value={finalPresentationDate}
                  onChange={(e) => setFinalPresentationDate(e.target.value)}
                  className="field tabular-nums sm:max-w-[calc(50%-0.5rem)]"
                />
              </div>
              <div>
                <label htmlFor="hf-status" className="field-label">Status</label>
                <select
                  id="hf-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as HackathonStatus)}
                  className="field"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="hf-priority" className="field-label">Priority</label>
                <select
                  id="hf-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as HackathonPriority)}
                  className="field"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </fieldset>

          <div className="flex items-center justify-end gap-2 pt-6 border-t border-rule">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {isEdit ? 'Save changes' : 'Add hackathon'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
