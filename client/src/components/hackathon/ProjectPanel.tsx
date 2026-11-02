import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { KanbanSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { HackathonView, ProjectSummary } from '@/lib/types';
import { PROJECT_STATUS_META } from '@/lib/project';
import { ProjectFormModal } from '@/components/project/ProjectFormModal';
import { Spinner } from '@/components/Loading';

interface Props {
  hackathon: HackathonView;
  onToast: (title: string, message: string, type?: 'success' | 'alert' | 'info') => void;
}

/** Projects built for this hackathon, and a one-click start that brings over its dates, links and team */
export const ProjectPanel: React.FC<Props> = ({ hackathon, onToast }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api
      .listProjects(hackathon.id)
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [hackathon.id]);

  return (
    <section aria-labelledby="hackathon-project-heading" className="bg-surface border border-rule rounded-2xl px-5 py-5">
      <h2 id="hackathon-project-heading" className="font-display text-lg font-semibold">
        Project
      </h2>
      {projects === null ? (
        <div className="mt-2">
          <Spinner label="Loading…" />
        </div>
      ) : projects.length === 0 ? (
        <p className="mt-1 text-sm text-ink-2">
          Track the build on a board with milestones. The deadline, submission links and teammates who joined come along.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link to={`/projects/${p.id}`} className="group block rounded-xl border border-rule px-3 py-3 hover:border-rule-strong">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm group-hover:text-accent">{p.title}</span>
                  <span className={`text-[11px] font-medium rounded px-1.5 py-0.5 shrink-0 ${PROJECT_STATUS_META[p.status].badge}`}>
                    {PROJECT_STATUS_META[p.status].label}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-sunken rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${PROJECT_STATUS_META[p.status].bar}`} style={{ width: `${p.progress}%` }} />
                  </div>
                  <span className="text-xs tabular-nums text-ink-2">{p.progress}%</span>
                </div>
                <p className="mt-1.5 text-xs text-ink-3">
                  {p.counts.total - p.counts.done} open cards
                  {p.counts.overdue > 0 && <span className="text-danger font-medium">, {p.counts.overdue} overdue</span>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {projects !== null && (
        <button onClick={() => setCreating(true)} className={`btn ${projects.length ? 'btn-ghost -ml-2' : 'btn-secondary'} mt-3 text-sm`}>
          <KanbanSquare className="w-4 h-4" />
          {projects.length ? 'Start another project' : 'Start a project tracker'}
        </button>
      )}

      {creating && (
        <ProjectFormModal
          initial={{
            title: hackathon.title,
            status: 'building',
            hackathonId: hackathon.id,
            startDate: hackathon.kickoffDate,
            targetDate: hackathon.submissionDeadline,
            links: {
              repoUrl: hackathon.submission.repoUrl,
              demoUrl: hackathon.submission.projectUrl,
              videoUrl: hackathon.submission.demoVideoUrl,
              deckUrl: hackathon.submission.deckUrl,
            },
          }}
          onClose={() => setCreating(false)}
          onSubmit={async (details, { addTeammates }) => {
            try {
              const project = await api.createProject({ ...details, addTeammates });
              navigate(`/projects/${project.id}`);
              return true;
            } catch (err) {
              onToast('Could not create the project', err instanceof Error ? err.message : 'Try again.', 'alert');
              return false;
            }
          }}
        />
      )}
    </section>
  );
};
