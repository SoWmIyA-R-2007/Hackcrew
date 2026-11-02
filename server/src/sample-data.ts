import { ObjectId } from 'mongodb';
import type { ProjectDoc } from './models.js';
import type {
  BoardColumn,
  HackathonView,
  Milestone,
  ProjectActivity,
  ProjectTask,
} from '../../client/src/lib/types.js';

export type SampleHackathon = Omit<HackathonView, 'id' | 'code' | 'role' | 'version'>;

/** ISO timestamp a whole number of days from now, at the given UTC hour */
function daysFromNow(days: number, hourUtc: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date.toISOString();
}

/**
 * Sample hackathons for new accounts and demo sessions. Dates are relative to today so the
 * schedule always shows one hackathon due soon, one later, and one finished.
 */
export interface SampleOwner {
  userId: string;
  name: string;
  email: string;
}

/**
 * Sample hackathons for new accounts and demo sessions. When an owner is given they take the place of
 * the sample team lead (Alex Vance), so their tasks show up under My tasks.
 */
export function buildSampleHackathons(owner?: SampleOwner): SampleHackathon[] {
  const list = withTaskDetails([
    {
      title: 'AI Innovators Global Hackathon 2026',
      teamName: 'CyberSpectres',
      domain: 'Artificial Intelligence & Agents',
      psId: 'PS-AI-04',
      problemStatement:
        'Build an autonomous agentic framework that streamlines multi-step developer workflows, automates code review, and deploys verified fixes.',
      status: 'in_progress',
      priority: 'high',
      completion: 65,
      timeRemaining: '4 DAYS',
      kickoffDate: daysFromNow(-12, 9),
      submissionDeadline: daysFromNow(4, 18),
      registrationDeadline: daysFromNow(-20, 18),
      shortlistDate: daysFromNow(8, 12),
      finalPresentationDate: daysFromNow(12, 10),
      submission: { repoUrl: 'https://github.com/cyberspectres/agent-flow', demoVideoUrl: '', deckUrl: '', projectUrl: '' },
      result: { outcome: 'pending', placement: '', prize: '', notes: '' },
      reminders: { enabled: true, daysBefore: [7, 3, 1] },
      bannerImage:
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
      mode: 'online',
      websiteLink: 'https://ai-innovators-2026.devpost.com',
      operatives: [
        {
          id: 'op-1',
          name: 'Alex Vance',
          email: 'alex.vance@hacktrack.dev',
          role: 'Team Lead / Full Stack',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        },
        {
          id: 'op-2',
          name: 'Sowmiya R',
          email: 'sowmiya@hacktrack.dev',
          role: 'Backend & DB Architect',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
        },
        {
          id: 'op-3',
          name: 'Devon Miles',
          email: 'devon@hacktrack.dev',
          role: 'AI / Prompt Engineer',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        },
      ],
      tasks: [
        {
          id: 't-1',
          title: 'Draft System Architecture & High-Level Design Doc',
          completed: true,
          weight: 1,
          assigneeName: 'Alex Vance',
          assigneeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        },
        {
          id: 't-2',
          title: 'Configure Supabase Schema, Migrations & RLS Policies',
          completed: true,
          weight: 2,
          assigneeName: 'Sowmiya R',
          assigneeAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
        },
        {
          id: 't-3',
          title: 'Implement Multi-Agent Orchestrator Loop in Python',
          completed: true,
          weight: 3,
          assigneeName: 'Devon Miles',
          assigneeAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        },
        {
          id: 't-4',
          title: 'Build Neo-Brutalist Dashboard UI & Mission Control',
          completed: false,
          weight: 2,
          assigneeName: 'Alex Vance',
          assigneeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        },
        {
          id: 't-5',
          title: 'Record 3-Minute Demo Video & Draft Pitch Deck',
          completed: false,
          weight: 3,
          assigneeName: 'Sowmiya R',
          assigneeAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
        },
      ],
    },
    {
      title: 'Web3 & CyberOps Security Summit',
      teamName: 'ZeroDay Protocol',
      domain: 'Cybersecurity & Smart Contracts',
      psId: 'PS-SEC-12',
      problemStatement:
        'Develop a automated vulnerability scanner for decentralized smart contracts that flags potential re-entrancy vectors in real time.',
      status: 'in_progress',
      priority: 'medium',
      completion: 40,
      timeRemaining: '12 DAYS',
      kickoffDate: daysFromNow(-6, 9),
      submissionDeadline: daysFromNow(12, 18),
      registrationDeadline: daysFromNow(-10, 18),
      shortlistDate: null,
      finalPresentationDate: daysFromNow(16, 10),
      submission: { repoUrl: '', demoVideoUrl: '', deckUrl: '', projectUrl: '' },
      result: { outcome: 'pending', placement: '', prize: '', notes: '' },
      reminders: { enabled: true, daysBefore: [7, 3, 1] },
      bannerImage:
        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
      mode: 'hybrid',
      websiteLink: 'https://cyberops-hackathon.org',
      operatives: [
        {
          id: 'op-1',
          name: 'Alex Vance',
          email: 'alex.vance@hacktrack.dev',
          role: 'Team Lead',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        },
        {
          id: 'op-4',
          name: 'Kavya Sharma',
          email: 'kavya@hacktrack.dev',
          role: 'Security Researcher',
          avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
        },
      ],
      tasks: [
        {
          id: 't-201',
          title: 'Static Analysis Parser Engine for Solidity',
          completed: true,
          weight: 3,
          assigneeName: 'Kavya Sharma',
          assigneeAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
        },
        {
          id: 't-202',
          title: 'Real-time WebSocket Alert Feed Component',
          completed: false,
          weight: 2,
          assigneeName: 'Alex Vance',
          assigneeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        },
        {
          id: 't-203',
          title: 'Benchmarking & Test Case Suite against Ethernaut',
          completed: false,
          weight: 2,
          assigneeName: 'Kavya Sharma',
          assigneeAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
        },
      ],
    },
    {
      title: 'ClimateTech & Sustainability Challenge',
      teamName: 'EcoPulse',
      domain: 'Clean Energy & Green Tech',
      psId: 'PS-ECO-01',
      problemStatement:
        'Build an IoT sensor telemetry platform forecasting urban carbon offset scores using predictive ML models.',
      status: 'completed',
      priority: 'low',
      completion: 100,
      timeRemaining: 'COMPLETED',
      kickoffDate: daysFromNow(-40, 9),
      submissionDeadline: daysFromNow(-26, 18),
      registrationDeadline: daysFromNow(-45, 18),
      shortlistDate: daysFromNow(-22, 12),
      finalPresentationDate: daysFromNow(-18, 10),
      submission: {
        repoUrl: 'https://github.com/ecopulse/carbon-score',
        demoVideoUrl: 'https://youtu.be/ecopulse-demo',
        deckUrl: 'https://slides.example.com/ecopulse',
        projectUrl: 'https://devpost.com/software/ecopulse',
      },
      result: { outcome: 'winner', placement: '2nd place, Best Overall', prize: '$2,000', notes: 'Judges liked the live sensor demo.' },
      reminders: { enabled: true, daysBefore: [7, 3, 1] },
      bannerImage:
        'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
      mode: 'offline',
      websiteLink: 'https://climatetech-2026.com',
      operatives: [
        {
          id: 'op-1',
          name: 'Alex Vance',
          email: 'alex.vance@hacktrack.dev',
          role: 'Team Lead',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        },
        {
          id: 'op-2',
          name: 'Sowmiya R',
          email: 'sowmiya@hacktrack.dev',
          role: 'Data Scientist',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
        },
      ],
      tasks: [
        {
          id: 't-301',
          title: 'Sensor Data Ingestion Pipeline',
          completed: true,
          weight: 2,
          assigneeName: 'Alex Vance',
          assigneeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        },
        {
          id: 't-302',
          title: 'Carbon Score Machine Learning Model',
          completed: true,
          weight: 3,
          assigneeName: 'Sowmiya R',
          assigneeAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
        },
        {
          id: 't-303',
          title: 'Final Presentation & Jury Pitch Submitted',
          completed: true,
          weight: 3,
          assigneeName: 'Alex Vance',
          assigneeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        },
      ],
    },
  ]);
  return owner ? withOwner(list, owner) : list;
}

/** Puts the account owner in Alex Vance's place on every sample team and task */
function withOwner(list: SampleHackathon[], owner: SampleOwner): SampleHackathon[] {
  const id = `op-${owner.userId}`;
  const joinedAt = new Date().toISOString();
  return list.map((h) => ({
    ...h,
    operatives: h.operatives.map((o) =>
      o.name === 'Alex Vance'
        ? { ...o, id, name: owner.name, email: owner.email, userId: owner.userId, invitePending: false, joinedAt }
        : o
    ),
    tasks: h.tasks.map((t) => (t.assigneeName === 'Alex Vance' ? { ...t, assigneeId: id, assigneeName: owner.name } : t)),
  }));
}

/** Links each sample task to its assignee and gives open tasks a due date before the deadline */
function withTaskDetails(list: SampleHackathon[]): SampleHackathon[] {
  return list.map((h) => {
    const deadline = h.submissionDeadline ? new Date(h.submissionDeadline).getTime() : Date.now();
    let open = 0;
    return {
      ...h,
      tasks: h.tasks.map((t) => ({
        ...t,
        assigneeId: h.operatives.find((o) => o.name === t.assigneeName)?.id ?? null,
        dueDate: t.completed ? null : new Date(deadline - ++open * 24 * 60 * 60 * 1000).toISOString(),
      })),
    };
  });
}

/**
 * A sample project for demo sessions, linked to the first sample hackathon, so the board, milestones and
 * history have something to show. Cards marked mine are assigned to the demo user.
 */
export function buildSampleProject(ownerId: ObjectId, ownerName: string, hackathonId: ObjectId | null, expiresAt?: Date): ProjectDoc {
  const owner = ownerId.toHexString();
  const now = new Date();
  const ms = (id: string, title: string, days: number, done = false): Milestone => ({
    id,
    title,
    dueDate: daysFromNow(days, 18),
    done,
    doneAt: done ? daysFromNow(days, 18) : null,
  });
  const card = (
    title: string,
    column: BoardColumn,
    priority: ProjectTask['priority'],
    options: { mine?: boolean; due?: number; milestoneId?: string; notes?: string } = {}
  ): ProjectTask => ({
    id: `pt-${new ObjectId().toHexString()}`,
    title,
    notes: options.notes ?? '',
    column,
    priority,
    assigneeId: options.mine ? owner : null,
    dueDate: options.due === undefined ? null : daysFromNow(options.due, 17),
    milestoneId: options.milestoneId ?? null,
    createdAt: daysFromNow(-6, 10),
    completedAt: column === 'done' ? daysFromNow(-2, 15) : null,
    assignedBy: options.mine ? owner : null,
    assignedAt: options.mine ? daysFromNow(-5, 10) : null,
    pullRequest: null,
  });
  const log = (text: string, daysAgo: number): ProjectActivity => ({
    id: new ObjectId().toHexString(),
    at: daysFromNow(-daysAgo, 12),
    actorId: owner,
    actorName: ownerName,
    text,
  });

  return {
    _id: new ObjectId(),
    ownerId,
    memberIds: [],
    members: [],
    title: 'ReviewPilot',
    tagline: 'An agent that reviews pull requests, explains the risks and opens verified fixes.',
    description:
      'Built for the AI Innovators hackathon. The agent reads a pull request, runs the tests, flags risky changes in plain language and proposes a fix as a new commit when it is confident.',
    status: 'building',
    hackathonId,
    techStack: ['Python', 'LangGraph', 'FastAPI', 'React', 'GitHub API'],
    links: { repoUrl: '', demoUrl: '', videoUrl: '', deckUrl: '' },
    startDate: daysFromNow(-7, 9),
    targetDate: daysFromNow(4, 18),
    milestones: [
      ms('ms-prototype', 'Working prototype', -2, true),
      ms('ms-demo', 'Demo-ready build', 2),
      ms('ms-pitch', 'Pitch and video', 4),
    ],
    tasks: [
      card('Parse pull request diffs into review chunks', 'done', 'high', { milestoneId: 'ms-prototype' }),
      card('Run the test suite in a sandbox', 'done', 'high', { mine: true, milestoneId: 'ms-prototype' }),
      card('Explain risky changes in plain language', 'review', 'high', { mine: true, due: 1, milestoneId: 'ms-demo' }),
      card('Open a fix as a new commit', 'in_progress', 'high', { due: 2, milestoneId: 'ms-demo' }),
      card('GitHub app sign-in', 'in_progress', 'medium', { mine: true, due: -1, milestoneId: 'ms-demo', notes: 'Use the app installation token, not a personal token.' }),
      card('Dashboard of reviewed pull requests', 'todo', 'medium', { due: 3, milestoneId: 'ms-demo' }),
      card('Record the demo video', 'todo', 'high', { mine: true, due: 4, milestoneId: 'ms-pitch' }),
      card('Write the pitch deck', 'todo', 'medium', { due: 4, milestoneId: 'ms-pitch' }),
      card('Support GitLab merge requests', 'backlog', 'low'),
    ],
    activity: [
      log('created the project', 7),
      log('added the milestone “Working prototype”', 7),
      log('completed “Parse pull request diffs into review chunks”', 3),
      log('reached the milestone “Working prototype”', 2),
      log('moved “Explain risky changes in plain language” to In review', 1),
    ],
    createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: now,
    ...(expiresAt ? { expiresAt } : {}),
  };
}
