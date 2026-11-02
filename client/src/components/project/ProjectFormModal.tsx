import React, { useEffect, useState } from 'react';
import { api, type ProjectDetails } from '@/lib/api';
import { HackathonView, ProjectStatus } from '@/lib/types';
import { PROJECT_STATUSES, PROJECT_STATUS_META, fromDateInput, parseTechStack, toDateInput } from '@/lib/project';
import { Modal } from './Modal';

interface Props {
  // Editing an existing project when given; otherwise creating one, optionally prefilled
  project?: (ProjectDetails & { id: string }) | null;
  initial?: Partial<ProjectDetails>;
  onClose: () => void;
  onSubmit: (details: ProjectDetails, options: { addTeammates: boolean }) => Promise<boolean>;
}

const LINK_FIELDS: { key: keyof ProjectDetails['links']; label: string; placeholder: string }[] = [
  { key: 'repoUrl', label: 'Code repository', placeholder: 'https://github.com/you/project' },
  { key: 'demoUrl', label: 'Live demo', placeholder: 'https://project.vercel.app' },
  { key: 'videoUrl', label: 'Demo video', placeholder: 'https://youtu.be/…' },
  { key: 'deckUrl', label: 'Pitch deck', placeholder: 'https://…' },
];

export const ProjectFormModal: React.FC<Props> = ({ project, initial, onClose, onSubmit }) => {
  const start = project ?? initial ?? {};
  const isEdit = Boolean(project);
  const [title, setTitle] = useState(start.title ?? '');
  const [tagline, setTagline] = useState(start.tagline ?? '');
  const [status, setStatus] = useState<ProjectStatus>(start.status ?? 'building');
  const [hackathonId, setHackathonId] = useState(start.hackathonId ?? '');
  const [addTeammates, setAddTeammates] = useState(true);
  const [startDate, setStartDate] = useState(toDateInput(start.startDate ?? null));
  const [targetDate, setTargetDate] = useState(toDateInput(start.targetDate ?? null));
  const [techStack, setTechStack] = useState((start.techStack ?? []).join(', '));
  const [description, setDescription] = useState(start.description ?? '');
  const [links, setLinks] = useState({ repoUrl: '', demoUrl: '', videoUrl: '', deckUrl: '', ...start.links });
  const [hackathons, setHackathons] = useState<HackathonView[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .listHackathons()
      .then(setHackathons)
      .catch(() => {
        // Linking is optional; the select just stays empty
      });
  }, []);

  const linked = hackathons.find((h) => h.id === hackathonId);
  const joinedTeammates = linked ? linked.operatives.filter((o) => o.userId && o.id !== `op-${o.userId}`).length : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const ok = await onSubmit(
      {
        title: title.trim(),
        tagline: tagline.trim(),
        status,
        hackathonId: hackathonId || null,
        startDate: fromDateInput(startDate),
        targetDate: fromDateInput(targetDate),
        techStack: parseTechStack(techStack),
        description,
        links: {
          repoUrl: links.repoUrl.trim(),
          demoUrl: links.demoUrl.trim(),
          videoUrl: links.videoUrl.trim(),
          deckUrl: links.deckUrl.trim(),
        },
      },
      { addTeammates: !isEdit && addTeammates && joinedTeammates > 0 }
    );
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title={isEdit ? 'Edit project' : 'New project'} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="pf-title" className="field-label">
              Project name
            </label>
            <input
              id="pf-title"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ReviewPilot"
              className="field"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="pf-tagline" className="field-label">
              One-line pitch (optional)
            </label>
            <input
              id="pf-tagline"
              maxLength={160}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="An agent that reviews pull requests and opens verified fixes"
              className="field"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pf-status" className="field-label">
                Status
              </label>
              <select id="pf-status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className="field">
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pf-hackathon" className="field-label">
                Built for a hackathon (optional)
              </label>
              <select id="pf-hackathon" value={hackathonId} onChange={(e) => setHackathonId(e.target.value)} className="field">
                <option value="">Not linked</option>
                {/* Keep the current link selectable while the list loads */}
                {hackathonId && !linked && <option value={hackathonId}>{project ? 'Current hackathon' : 'Selected hackathon'}</option>}
                {hackathons.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!isEdit && joinedTeammates > 0 && (
            <label className="flex items-start gap-2.5 text-sm text-ink-2 cursor-pointer">
              <input
                type="checkbox"
                checked={addTeammates}
                onChange={(e) => setAddTeammates(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[var(--accent)]"
              />
              <span>
                Invite the {joinedTeammates} {joinedTeammates === 1 ? 'teammate' : 'teammates'} from team {linked!.teamName} to
                collaborate
              </span>
            </label>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pf-start" className="field-label">
                Start date
              </label>
              <input id="pf-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="field" />
            </div>
            <div>
              <label htmlFor="pf-target" className="field-label">
                Target date
              </label>
              <input id="pf-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="field" />
            </div>
          </div>
          <div>
            <label htmlFor="pf-stack" className="field-label">
              Tech stack, separated by commas
            </label>
            <input
              id="pf-stack"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              placeholder="React, Node.js, MongoDB"
              className="field"
            />
          </div>
        </div>

        {isEdit && (
          <>
            <div className="pt-6 border-t border-rule">
              <label htmlFor="pf-description" className="field-label">
                About the project
              </label>
              <textarea
                id="pf-description"
                rows={4}
                maxLength={5000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What it does, who it is for, and how it works"
                className="field resize-y"
              />
            </div>
            <fieldset className="pt-6 border-t border-rule">
              <legend className="text-sm font-semibold text-ink mb-3">Links</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {LINK_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label htmlFor={`pf-${f.key}`} className="field-label">
                      {f.label}
                    </label>
                    <input
                      id={`pf-${f.key}`}
                      type="url"
                      value={links[f.key]}
                      onChange={(e) => setLinks((l) => ({ ...l, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="field"
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <div className="flex items-center justify-end gap-2 pt-6 border-t border-rule">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create project'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
