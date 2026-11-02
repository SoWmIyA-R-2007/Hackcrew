import { HackathonOutcome, SubmissionLinks } from './types';

export const OUTCOME_LABEL: Record<HackathonOutcome, string> = {
  pending: 'Waiting for results',
  participated: 'Took part',
  shortlisted: 'Shortlisted',
  finalist: 'Finalist',
  winner: 'Won a prize',
};

export const SUBMISSION_FIELDS: { key: keyof SubmissionLinks; label: string; placeholder: string }[] = [
  { key: 'repoUrl', label: 'Code repository', placeholder: 'https://github.com/team/project' },
  { key: 'demoVideoUrl', label: 'Demo video', placeholder: 'https://youtu.be/…' },
  { key: 'deckUrl', label: 'Pitch deck', placeholder: 'https://docs.google.com/presentation/…' },
  { key: 'projectUrl', label: 'Project page', placeholder: 'https://devpost.com/software/…' },
];

export function submissionReadiness(links: SubmissionLinks) {
  const done = SUBMISSION_FIELDS.filter((f) => links[f.key]).length;
  return { done, total: SUBMISSION_FIELDS.length, ready: done === SUBMISSION_FIELDS.length };
}
