import { Router, type Response } from 'express';
import { ObjectId, type Filter } from 'mongodb';
import { z } from 'zod';
import { collections } from '../db.js';
import { currentUserId, requireUser } from '../auth-middleware.js';
import { accessFilter, isoDate, link, type ProjectDoc, type UserDoc } from '../models.js';
import { areFriends, friendsOf, sendFriendRequest } from './friends.js';
import { GitHubError, parseGitHubRepo, readRepository } from '../github.js';
import type {
  BoardColumn,
  Milestone,
  MyProjectTask,
  ProjectActivity,
  ProjectCandidate,
  ProjectGitHub,
  ProjectHackathonLink,
  ProjectInvite,
  ProjectStatus,
  ProjectSummary,
  ProjectTask,
  ProjectView,
} from '../../../client/src/lib/types.js';

export const projectsRouter = Router();
projectsRouter.use(requireUser('Sign in to manage your projects.'));

const NOT_FOUND = 'Project not found. It may have been deleted, or you are no longer a collaborator.';
const OWNER_ONLY = 'Only the owner of this project can do that.';
const TASK_GONE = 'That task no longer exists. Someone may have deleted it.';
const MILESTONE_GONE = 'That milestone no longer exists.';
const MAX_TASKS = 500;
const MAX_MILESTONES = 50;
const MAX_MEMBERS = 20;
const MAX_ACTIVITY = 100;
// A project's repository is read from GitHub at most this often, however many people open it
const GITHUB_SYNC_COOLDOWN_MS = 30 * 1000;

export const COLUMN_LABEL: Record<BoardColumn, string> = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'In progress',
  review: 'In review',
  done: 'Done',
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  idea: 'Idea',
  building: 'Building',
  paused: 'Paused',
  shipped: 'Shipped',
  archived: 'Archived',
};

const EMPTY_LINKS = { repoUrl: '', demoUrl: '', videoUrl: '', deckUrl: '' };

const objectIdString = z.string().regex(/^[a-f0-9]{24}$/, 'Unknown id');
const optionalDate = isoDate.nullable();
const statusEnum = z.enum(['idea', 'building', 'paused', 'shipped', 'archived']);
const columnEnum = z.enum(['backlog', 'todo', 'in_progress', 'review', 'done']);
const priorityEnum = z.enum(['high', 'medium', 'low']);
const nonEmpty = (o: object) => Object.keys(o).length > 0;

// Tags such as "React", kept once each regardless of case (the first spelling wins)
const techStack = z
  .array(z.string().trim().min(1).max(30))
  .max(20, 'Keep the tech stack to 20 items')
  .transform((list) => list.filter((t, i) => list.findIndex((o) => o.toLowerCase() === t.toLowerCase()) === i));

const linksSchema = z.object({
  repoUrl: link.default(''),
  demoUrl: link.default(''),
  videoUrl: link.default(''),
  deckUrl: link.default(''),
});

const detailFields = {
  title: z.string().trim().min(1, 'Give the project a name').max(120),
  tagline: z.string().trim().max(160, 'Keep the tagline under 160 characters'),
  description: z.string().max(5000),
  status: statusEnum,
  hackathonId: objectIdString.nullable(),
  techStack,
  links: linksSchema,
  startDate: optionalDate,
  targetDate: optionalDate,
};

const createSchema = z.object({
  title: detailFields.title,
  tagline: detailFields.tagline.default(''),
  description: detailFields.description.default(''),
  status: statusEnum.default('building'),
  hackathonId: detailFields.hackathonId.default(null),
  techStack: techStack.default([]),
  links: linksSchema.default(EMPTY_LINKS),
  startDate: optionalDate.default(null),
  targetDate: optionalDate.default(null),
  // Adds the linked hackathon's teammates who have joined with an account as collaborators
  addTeammates: z.boolean().default(false),
});
const updateSchema = z.object(detailFields).partial().refine(nonEmpty, 'Nothing to change');

const taskFields = {
  title: z.string().trim().min(1, 'Give the task a title').max(300),
  notes: z.string().max(5000),
  column: columnEnum,
  priority: priorityEnum,
  assigneeId: objectIdString.nullable(),
  dueDate: optionalDate,
  milestoneId: z.string().max(100).nullable(),
  pullRequest: z.number().int().min(1).max(10_000_000).nullable(),
};
const taskCreateSchema = z.object({
  title: taskFields.title,
  notes: taskFields.notes.default(''),
  column: columnEnum.default('todo'),
  priority: priorityEnum.default('medium'),
  assigneeId: taskFields.assigneeId.default(null),
  dueDate: optionalDate.default(null),
  milestoneId: taskFields.milestoneId.default(null),
  pullRequest: taskFields.pullRequest.default(null),
});
const taskUpdateSchema = z.object(taskFields).partial().refine(nonEmpty, 'Nothing to change');

const milestoneTitle = z.string().trim().min(1, 'Give the milestone a name').max(120);
const milestoneCreateSchema = z.object({ title: milestoneTitle, dueDate: optionalDate.default(null) });
const milestoneUpdateSchema = z
  .object({ title: milestoneTitle, dueDate: optionalDate, done: z.boolean() })
  .partial()
  .refine(nonEmpty, 'Nothing to change');

// A friend or linked-hackathon teammate by account id, or anyone by username
const memberSchema = z.union([
  z.object({ userId: objectIdString }),
  z.object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .max(31)
      .transform((v) => v.replace(/^@/, ''))
      .refine((v) => v.length > 0, 'Enter a username'),
  }),
]);

type Actor = Pick<UserDoc, '_id' | 'name' | 'isDemo' | 'expiresAt'>;

function badRequest(res: Response, error: z.ZodError) {
  res.status(400).json({ error: error.issues[0].message });
}

function notFound(res: Response) {
  res.status(404).json({ error: NOT_FOUND });
}

/** Filter matching the project only if the signed-in user owns it or collaborates on it */
function accessibleById(id: string, res: Response): Filter<ProjectDoc> | null {
  if (!ObjectId.isValid(id)) return null;
  return { _id: new ObjectId(id), ...accessFilter(currentUserId(res)) };
}

async function currentActor(res: Response): Promise<Actor> {
  const { users } = await collections();
  const user = await users.findOne({ _id: currentUserId(res) }, { projection: { name: 1, isDemo: 1, expiresAt: 1 } });
  return user ?? { _id: currentUserId(res), name: 'Someone' };
}

const entry = (actor: Actor, text: string): ProjectActivity => ({
  id: new ObjectId().toHexString(),
  at: new Date().toISOString(),
  actorId: actor._id.toHexString(),
  actorName: actor.name,
  text,
});

/** A history line written by Hackcrew on GitHub's behalf, e.g. when a linked pull request is merged */
const githubEntry = (text: string): ProjectActivity => ({
  id: new ObjectId().toHexString(),
  at: new Date().toISOString(),
  actorId: 'github',
  actorName: 'GitHub',
  text,
});

/** The repository the project links to, with the last snapshot read from it if it is for that repository */
function githubOf(doc: ProjectDoc): ProjectGitHub | null {
  const repo = parseGitHubRepo(doc.links?.repoUrl);
  if (!repo) return null;
  const snapshot = doc.github?.repo.toLowerCase() === repo.toLowerCase() ? doc.github : null;
  return {
    repo,
    url: `https://github.com/${repo}`,
    syncedAt: snapshot?.syncedAt?.toISOString() ?? null,
    error: snapshot?.error ?? null,
    info: snapshot?.info ?? null,
    commits: snapshot?.commits ?? [],
    pulls: snapshot?.pulls ?? [],
  };
}

/** $push for new history lines, keeping only the latest ones */
const logged = (...entries: ProjectActivity[]) => ({ activity: { $each: entries, $slice: -MAX_ACTIVITY } });

const quote = (s: string) => `“${s.length > 60 ? `${s.slice(0, 57)}…` : s}”`;

/** Share of cards that are done, as a whole percentage */
export function projectProgress(tasks: Pick<ProjectTask, 'column'>[]) {
  return tasks.length ? Math.round((tasks.filter((t) => t.column === 'done').length / tasks.length) * 100) : 0;
}

const isTaskOverdue = (t: ProjectTask, now: number) => t.column !== 'done' && Boolean(t.dueDate) && Date.parse(t.dueDate!) < now;

/** Account ids that can be assigned cards: the owner and every collaborator */
const teamIds = (doc: ProjectDoc) => new Set([doc.ownerId, ...doc.memberIds].map((id) => id.toHexString()));

/** Names and usernames of everyone on (or invited to) the given projects */
async function peopleOf(docs: ProjectDoc[]) {
  const ids = [
    ...new Set(
      docs.flatMap((d) => [d.ownerId, ...d.memberIds, ...(d.pendingInvites ?? []).map((i) => i.userId)].map((id) => id.toHexString()))
    ),
  ];
  const { users } = await collections();
  const found = await users
    .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }, { projection: { name: 1, handle: 1 } })
    .toArray();
  return new Map(found.map((u) => [u._id.toHexString(), { name: u.name, username: u.handle ?? '' }]));
}

/** The hackathons the projects are linked to, and whether the viewer can open each */
async function hackathonLinksOf(docs: ProjectDoc[], viewerId: ObjectId) {
  const ids = docs.flatMap((d) => (d.hackathonId ? [d.hackathonId] : []));
  if (ids.length === 0) return new Map<string, ProjectHackathonLink>();
  const { hackathons } = await collections();
  const found = await hackathons
    .find({ _id: { $in: ids } }, { projection: { title: 1, teamName: 1, ownerId: 1, memberIds: 1 } })
    .toArray();
  return new Map(
    found.map((h) => [
      h._id.toHexString(),
      {
        id: h._id.toHexString(),
        title: h.title,
        teamName: h.teamName,
        canOpen: h.ownerId.equals(viewerId) || h.memberIds.some((id) => id.equals(viewerId)),
      },
    ])
  );
}

type People = Awaited<ReturnType<typeof peopleOf>>;
type HackathonLinks = Awaited<ReturnType<typeof hackathonLinksOf>>;

function membersOf(doc: ProjectDoc, people: People): ProjectView['members'] {
  const owner = people.get(doc.ownerId.toHexString());
  return [
    ...(owner
      ? [{ userId: doc.ownerId.toHexString(), ...owner, position: 'owner' as const, addedAt: doc.createdAt.toISOString() }]
      : []),
    ...doc.members.flatMap((m) => {
      const person = people.get(m.userId.toHexString());
      return person
        ? [{ userId: m.userId.toHexString(), ...person, position: 'collaborator' as const, addedAt: m.addedAt.toISOString() }]
        : [];
    }),
  ];
}

function toProjectView(doc: ProjectDoc, viewerId: ObjectId, people: People, links: HackathonLinks): ProjectView {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    tagline: doc.tagline,
    description: doc.description,
    status: doc.status,
    techStack: doc.techStack,
    links: { ...EMPTY_LINKS, ...doc.links },
    startDate: doc.startDate,
    targetDate: doc.targetDate,
    hackathon: doc.hackathonId ? (links.get(doc.hackathonId.toHexString()) ?? null) : null,
    members: membersOf(doc, people),
    invited: (doc.pendingInvites ?? []).flatMap((i) => {
      const person = people.get(i.userId.toHexString());
      return person
        ? [{ userId: i.userId.toHexString(), ...person, invitedAt: i.invitedAt.toISOString(), waitingForFriendship: i.waitingForFriendship }]
        : [];
    }),
    tasks: doc.tasks.map((t) => ({ ...t, pullRequest: t.pullRequest ?? null })),
    milestones: doc.milestones,
    activity: [...doc.activity].reverse(),
    github: githubOf(doc),
    progress: projectProgress(doc.tasks),
    role: doc.ownerId.equals(viewerId) ? 'owner' : 'collaborator',
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toSummary(doc: ProjectDoc, viewerId: ObjectId, people: People, links: HackathonLinks, now: number): ProjectSummary {
  const me = viewerId.toHexString();
  const next = doc.milestones
    .filter((m) => !m.done)
    .sort((a, b) => (a.dueDate ? Date.parse(a.dueDate) : Infinity) - (b.dueDate ? Date.parse(b.dueDate) : Infinity))[0];
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    tagline: doc.tagline,
    status: doc.status,
    techStack: doc.techStack,
    targetDate: doc.targetDate,
    hackathon: doc.hackathonId ? (links.get(doc.hackathonId.toHexString()) ?? null) : null,
    members: membersOf(doc, people).map(({ userId, name, username }) => ({ userId, name, username })),
    counts: {
      total: doc.tasks.length,
      done: doc.tasks.filter((t) => t.column === 'done').length,
      inProgress: doc.tasks.filter((t) => t.column === 'in_progress' || t.column === 'review').length,
      overdue: doc.tasks.filter((t) => isTaskOverdue(t, now)).length,
      mine: doc.tasks.filter((t) => t.column !== 'done' && t.assigneeId === me).length,
    },
    nextMilestone: next ? { id: next.id, title: next.title, dueDate: next.dueDate } : null,
    progress: projectProgress(doc.tasks),
    role: doc.ownerId.equals(viewerId) ? 'owner' : 'collaborator',
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function fullView(doc: ProjectDoc, viewerId: ObjectId) {
  const [people, links] = await Promise.all([peopleOf([doc]), hackathonLinksOf([doc], viewerId)]);
  return toProjectView(doc, viewerId, people, links);
}

/** A hackathon the user is on, or null */
async function accessibleHackathon(id: string, userId: ObjectId) {
  const { hackathons } = await collections();
  return hackathons.findOne({ _id: new ObjectId(id), ...accessFilter(userId) });
}

/** People on the linked hackathon's team who have joined with a (non-demo) account */
async function hackathonTeammates(hackathonId: ObjectId, viewerId: ObjectId) {
  const hackathon = await accessibleHackathon(hackathonId.toHexString(), viewerId);
  if (!hackathon) return [];
  const ids = hackathon.operatives
    .map((o) => o.userId)
    .filter((id): id is string => Boolean(id && ObjectId.isValid(id) && id !== viewerId.toHexString()));
  const { users } = await collections();
  return users
    .find(
      { _id: { $in: ids.map((id) => new ObjectId(id)) }, isDemo: { $ne: true } },
      { projection: { name: 1, handle: 1, profilePublic: 1 } }
    )
    .toArray();
}

// --- Projects ---------------------------------------------------------------

// Every project the user owns or collaborates on, most recently changed first. ?hackathonId= narrows to one hackathon
projectsRouter.get('/', async (req, res) => {
  const userId = currentUserId(res);
  const hackathonId = typeof req.query.hackathonId === 'string' ? req.query.hackathonId : null;
  if (hackathonId !== null && !ObjectId.isValid(hackathonId)) {
    res.json({ projects: [] });
    return;
  }
  const { projects } = await collections();
  const docs = await projects
    .find({ ...accessFilter(userId), ...(hackathonId ? { hackathonId: new ObjectId(hackathonId) } : {}) })
    .sort({ updatedAt: -1 })
    .toArray();
  const [people, links] = await Promise.all([peopleOf(docs), hackathonLinksOf(docs, userId)]);
  const now = Date.now();
  res.json({ projects: docs.map((d) => toSummary(d, userId, people, links, now)) });
});

// Cards assigned to the signed-in user across every project
projectsRouter.get('/my-tasks', async (_req, res) => {
  const userId = currentUserId(res);
  const me = userId.toHexString();
  const { projects } = await collections();
  const docs = await projects
    .find({ ...accessFilter(userId), 'tasks.assigneeId': me }, { projection: { title: 1, tasks: 1 } })
    .toArray();
  const tasks: MyProjectTask[] = docs.flatMap((d) =>
    d.tasks
      .filter((t) => t.assigneeId === me)
      .map((t) => ({ ...t, projectId: d._id.toHexString(), projectTitle: d.title }))
  );
  res.json({ tasks });
});

// Project invitations waiting for the signed-in user (held ones appear once the friend request is accepted)
projectsRouter.get('/invites/mine', async (_req, res) => {
  const userId = currentUserId(res);
  const { projects, users } = await collections();
  const docs = await projects
    .find(
      { pendingInvites: { $elemMatch: { userId, waitingForFriendship: false } } },
      { projection: { title: 1, tagline: 1, pendingInvites: 1 } }
    )
    .toArray();
  const mine = docs.map((d) => ({ doc: d, invite: d.pendingInvites!.find((i) => i.userId.equals(userId))! }));
  const inviters = await users.find({ _id: { $in: mine.map((m) => m.invite.invitedBy) } }, { projection: { name: 1 } }).toArray();
  const invites: ProjectInvite[] = mine
    .map(({ doc, invite }) => ({
      projectId: doc._id.toHexString(),
      projectTitle: doc.title,
      tagline: doc.tagline,
      invitedBy: inviters.find((u) => u._id.equals(invite.invitedBy))?.name ?? 'Someone',
      invitedAt: invite.invitedAt.toISOString(),
    }))
    .sort((a, b) => b.invitedAt.localeCompare(a.invitedAt));
  res.json({ invites });
});

// Accept a project invitation: you join as a collaborator
projectsRouter.post('/:id/invite/accept', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return notFound(res);
  const actor = await currentActor(res);
  if (actor.isDemo) {
    res.status(403).json({ error: 'Demo accounts cannot join projects. Create an account to accept the invitation.' });
    return;
  }
  const { projects } = await collections();
  const current = await projects.findOne({
    _id: new ObjectId(req.params.id),
    pendingInvites: { $elemMatch: { userId: actor._id, waitingForFriendship: false } },
  });
  const invite = current?.pendingInvites?.find((i) => i.userId.equals(actor._id));
  if (!current || !invite) {
    res.status(404).json({ error: 'This invitation is no longer available. It may have been withdrawn.' });
    return;
  }
  const doc = await projects.findOneAndUpdate(
    { _id: current._id, 'pendingInvites.userId': actor._id },
    {
      $pull: { pendingInvites: { userId: actor._id } },
      $addToSet: { memberIds: actor._id },
      $push: {
        members: { userId: actor._id, addedBy: invite.invitedBy, addedAt: new Date() },
        ...logged(entry(actor, 'joined the project')),
      },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' }
  );
  if (!doc) {
    res.status(404).json({ error: 'This invitation is no longer available. It may have been withdrawn.' });
    return;
  }
  res.json({ project: await fullView(doc, actor._id) });
});

// Decline a project invitation
projectsRouter.delete('/:id/invite', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) return notFound(res);
  const actor = await currentActor(res);
  const { projects } = await collections();
  const result = await projects.updateOne(
    { _id: new ObjectId(req.params.id), pendingInvites: { $elemMatch: { userId: actor._id, waitingForFriendship: false } } },
    {
      $pull: { pendingInvites: { userId: actor._id } },
      $push: logged(entry(actor, 'declined the invitation')),
      $set: { updatedAt: new Date() },
    }
  );
  if (!result.modifiedCount) {
    res.status(404).json({ error: 'This invitation is no longer available.' });
    return;
  }
  res.json({ ok: true });
});

projectsRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const actor = await currentActor(res);
  const { addTeammates, hackathonId, ...fields } = parsed.data;

  const hackathon = hackathonId ? await accessibleHackathon(hackathonId, actor._id) : null;
  if (hackathonId && !hackathon) {
    res.status(404).json({ error: 'That hackathon was not found, or you are no longer on its team.' });
    return;
  }
  const now = new Date();
  const teammates = hackathon && addTeammates ? (await hackathonTeammates(hackathon._id, actor._id)).slice(0, MAX_MEMBERS) : [];
  const activity = [entry(actor, 'created the project')];
  if (teammates.length > 0) {
    activity.push(entry(actor, `invited ${teammates.map((t) => t.name).join(', ')} from team ${hackathon!.teamName}`));
  }

  const doc: ProjectDoc = {
    _id: new ObjectId(),
    ownerId: actor._id,
    memberIds: [],
    members: [],
    // Teammates are invited, and join when they accept
    pendingInvites: teammates.map((t) => ({ userId: t._id, invitedBy: actor._id, invitedAt: now, waitingForFriendship: false })),
    ...fields,
    hackathonId: hackathon?._id ?? null,
    tasks: [],
    milestones: [],
    activity,
    createdAt: now,
    updatedAt: now,
    // Demo projects are removed with the demo account
    ...(actor.expiresAt ? { expiresAt: actor.expiresAt } : {}),
  };
  const { projects } = await collections();
  await projects.insertOne(doc);
  res.status(201).json({ project: await fullView(doc, actor._id) });
});

projectsRouter.get('/:id', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  const { projects } = await collections();
  const doc = filter && (await projects.findOne(filter));
  if (!doc) return notFound(res);
  res.json({ project: await fullView(doc, currentUserId(res)) });
});

// Edit details. Everyone on the project can; each field is saved on its own so edits rarely collide
projectsRouter.patch('/:id', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter) return notFound(res);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);

  const actor = await currentActor(res);
  const { projects } = await collections();
  const current = await projects.findOne(filter);
  if (!current) return notFound(res);

  const { hackathonId, ...fields } = parsed.data;
  const set: Partial<ProjectDoc> = { ...fields, updatedAt: new Date() };
  if (hackathonId !== undefined) {
    if (hackathonId === null) set.hackathonId = null;
    else if (!current.hackathonId?.equals(hackathonId)) {
      const hackathon = await accessibleHackathon(hackathonId, actor._id);
      if (!hackathon) {
        res.status(404).json({ error: 'That hackathon was not found, or you are not on its team.' });
        return;
      }
      set.hackathonId = hackathon._id;
    }
  }

  const history: ProjectActivity[] = [];
  if (fields.status && fields.status !== current.status) {
    history.push(entry(actor, `changed the status to ${STATUS_LABEL[fields.status]}`));
  }
  if (fields.title && fields.title !== current.title) history.push(entry(actor, `renamed the project to ${quote(fields.title)}`));
  if (set.hackathonId !== undefined && String(set.hackathonId) !== String(current.hackathonId)) {
    history.push(entry(actor, set.hackathonId ? 'linked the project to a hackathon' : 'unlinked the hackathon'));
  }
  const otherChanged = (['tagline', 'description', 'techStack', 'links', 'startDate', 'targetDate'] as const).some(
    (k) => fields[k] !== undefined && JSON.stringify(fields[k]) !== JSON.stringify(current[k])
  );
  if (otherChanged) history.push(entry(actor, 'updated the project details'));

  const doc = await projects.findOneAndUpdate(
    filter,
    { $set: set, ...(history.length ? { $push: logged(...history) } : {}) },
    { returnDocument: 'after' }
  );
  if (!doc) return notFound(res);
  res.json({ project: await fullView(doc, actor._id) });
});

projectsRouter.delete('/:id', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  const { projects, users } = await collections();
  const doc = filter && (await projects.findOne(filter));
  if (!doc) return notFound(res);
  if (!doc.ownerId.equals(currentUserId(res))) {
    res.status(403).json({ error: `${OWNER_ONLY} You can leave the project instead.` });
    return;
  }
  await projects.deleteOne({ _id: doc._id });
  await users.updateMany({ profileProjectIds: doc._id }, { $pull: { profileProjectIds: doc._id } });
  res.json({ ok: true });
});

// --- Board ------------------------------------------------------------------

/** Checks a card's assignee and milestone against the project; returns an error message or null */
function checkTaskRefs(doc: ProjectDoc, fields: { assigneeId?: string | null; milestoneId?: string | null }) {
  if (fields.assigneeId && !teamIds(doc).has(fields.assigneeId)) return 'Cards can only be assigned to people on the project.';
  if (fields.milestoneId && !doc.milestones.some((m) => m.id === fields.milestoneId)) return MILESTONE_GONE;
  return null;
}

projectsRouter.post('/:id/tasks', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter) return notFound(res);
  const parsed = taskCreateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);

  const actor = await currentActor(res);
  const { projects } = await collections();
  const current = await projects.findOne(filter);
  if (!current) return notFound(res);
  const refError = checkTaskRefs(current, parsed.data);
  if (refError) {
    res.status(400).json({ error: refError });
    return;
  }

  const now = new Date().toISOString();
  const assignee = parsed.data.assigneeId;
  const task: ProjectTask = {
    id: `pt-${new ObjectId().toHexString()}`,
    ...parsed.data,
    createdAt: now,
    completedAt: parsed.data.column === 'done' ? now : null,
    assignedBy: assignee ? actor._id.toHexString() : null,
    assignedAt: assignee ? now : null,
  };
  const people = assignee ? await peopleOf([current]) : null;
  const assigneeName = assignee ? (people!.get(assignee)?.name ?? 'someone') : null;
  const text =
    `added ${quote(task.title)}` +
    (assignee ? (assignee === actor._id.toHexString() ? ' and took it' : ` and assigned it to ${assigneeName}`) : '');

  const doc = await projects.findOneAndUpdate(
    { $and: [filter, { [`tasks.${MAX_TASKS - 1}`]: { $exists: false } }] },
    { $push: { tasks: task, ...logged(entry(actor, text)) }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!doc) {
    res.status(400).json({ error: `A project can have up to ${MAX_TASKS} cards. Delete finished ones to add more.` });
    return;
  }
  res.status(201).json({ project: await fullView(doc, actor._id), task });
});

// Move, assign, rename or edit one card
projectsRouter.patch('/:id/tasks/:taskId', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter) return notFound(res);
  const parsed = taskUpdateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);

  const actor = await currentActor(res);
  const me = actor._id.toHexString();
  const { projects } = await collections();
  const current = await projects.findOne(filter);
  if (!current) return notFound(res);
  const task = current.tasks.find((t) => t.id === req.params.taskId);
  if (!task) {
    res.status(404).json({ error: TASK_GONE });
    return;
  }
  const refError = checkTaskRefs(current, parsed.data);
  if (refError) {
    res.status(400).json({ error: refError });
    return;
  }

  const changes = parsed.data;
  const now = new Date().toISOString();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(changes)) set[`tasks.$[t].${key}`] = value;
  const history: ProjectActivity[] = [];
  const title = changes.title ?? task.title;

  if (changes.column && changes.column !== task.column) {
    set['tasks.$[t].completedAt'] = changes.column === 'done' ? now : null;
    history.push(
      entry(actor, changes.column === 'done' ? `completed ${quote(title)}` : `moved ${quote(title)} to ${COLUMN_LABEL[changes.column]}`)
    );
  }
  if (changes.assigneeId !== undefined && changes.assigneeId !== task.assigneeId) {
    set['tasks.$[t].assignedBy'] = changes.assigneeId ? me : null;
    set['tasks.$[t].assignedAt'] = changes.assigneeId ? now : null;
    if (!changes.assigneeId) history.push(entry(actor, `unassigned ${quote(title)}`));
    else if (changes.assigneeId === me) history.push(entry(actor, `took ${quote(title)}`));
    else {
      const name = (await peopleOf([current])).get(changes.assigneeId)?.name ?? 'someone';
      history.push(entry(actor, `assigned ${quote(title)} to ${name}`));
    }
  }
  if (changes.title && changes.title !== task.title) history.push(entry(actor, `renamed ${quote(task.title)} to ${quote(changes.title)}`));
  // Linking a pull request that is already merged finishes the card straight away
  const merged =
    changes.pullRequest && changes.pullRequest !== task.pullRequest
      ? githubOf(current)?.pulls.find((p) => p.number === changes.pullRequest && p.state === 'merged')
      : undefined;
  if (merged && (changes.column ?? task.column) !== 'done') {
    set['tasks.$[t].column'] = 'done';
    set['tasks.$[t].completedAt'] = merged.mergedAt ?? now;
    history.push(githubEntry(`moved ${quote(title)} to Done: pull request #${merged.number} is merged`));
  }
  const otherChanged = (['notes', 'priority', 'dueDate', 'milestoneId', 'pullRequest'] as const).some(
    (k) => changes[k] !== undefined && changes[k] !== (task[k] ?? null)
  );
  if (otherChanged && history.length === 0) history.push(entry(actor, `updated ${quote(title)}`));

  const doc = await projects.findOneAndUpdate(
    { $and: [filter, { 'tasks.id': task.id }] },
    { $set: set, ...(history.length ? { $push: logged(...history) } : {}) },
    { arrayFilters: [{ 't.id': task.id }], returnDocument: 'after' }
  );
  if (!doc) {
    res.status(404).json({ error: TASK_GONE });
    return;
  }
  res.json({ project: await fullView(doc, actor._id) });
});

projectsRouter.delete('/:id/tasks/:taskId', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter) return notFound(res);
  const actor = await currentActor(res);
  const { projects } = await collections();
  const current = await projects.findOne(filter);
  if (!current) return notFound(res);
  const task = current.tasks.find((t) => t.id === req.params.taskId);
  if (!task) {
    res.status(404).json({ error: TASK_GONE });
    return;
  }
  const doc = await projects.findOneAndUpdate(
    filter,
    {
      $pull: { tasks: { id: task.id } },
      $push: logged(entry(actor, `deleted ${quote(task.title)}`)),
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' }
  );
  if (!doc) return notFound(res);
  res.json({ project: await fullView(doc, actor._id) });
});

// --- GitHub -------------------------------------------------------------------

/**
 * Reads the linked public GitHub repository: details, latest commits and pull requests. Cards linked to a
 * pull request that has been merged move to Done. Answers with the cached copy if it was read moments ago
 */
projectsRouter.post('/:id/github/sync', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter) return notFound(res);
  const { projects } = await collections();
  const current = await projects.findOne(filter);
  if (!current) return notFound(res);
  const github = githubOf(current);
  if (!github) {
    res.status(400).json({ error: 'Add a GitHub repository link (Edit → Code repository) first.' });
    return;
  }
  if (github.syncedAt && Date.now() - Date.parse(github.syncedAt) < GITHUB_SYNC_COOLDOWN_MS) {
    res.json({ project: await fullView(current, currentUserId(res)) });
    return;
  }

  let snapshot: Pick<ProjectGitHub, 'info' | 'commits' | 'pulls'>;
  try {
    snapshot = await readRepository(github.repo);
  } catch (err) {
    if (!(err instanceof GitHubError)) throw err;
    // Keep what was read before, and remember why this attempt failed
    const doc = await projects.findOneAndUpdate(
      filter,
      {
        $set: {
          github: {
            repo: github.repo,
            syncedAt: new Date(),
            error: err.message,
            info: github.info,
            commits: github.commits,
            pulls: github.pulls,
          },
        },
      },
      { returnDocument: 'after' }
    );
    res.json({ project: await fullView(doc ?? current, currentUserId(res)) });
    return;
  }

  const merged = new Map(snapshot.pulls.filter((p) => p.state === 'merged').map((p) => [p.number, p]));
  const finished = current.tasks.filter((t) => t.pullRequest && t.column !== 'done' && merged.has(t.pullRequest));
  const set: Record<string, unknown> = { github: { repo: github.repo, syncedAt: new Date(), error: null, ...snapshot } };
  finished.forEach((t, i) => {
    set[`tasks.$[c${i}].column`] = 'done';
    set[`tasks.$[c${i}].completedAt`] = merged.get(t.pullRequest!)!.mergedAt ?? new Date().toISOString();
  });
  if (finished.length) set.updatedAt = new Date();
  const doc = await projects.findOneAndUpdate(
    filter,
    {
      $set: set,
      ...(finished.length
        ? { $push: logged(...finished.map((t) => githubEntry(`moved ${quote(t.title)} to Done: pull request #${t.pullRequest} was merged`))) }
        : {}),
    },
    { arrayFilters: finished.map((t, i) => ({ [`c${i}.id`]: t.id })), returnDocument: 'after' }
  );
  res.json({ project: await fullView(doc ?? current, currentUserId(res)), finished: finished.length });
});

// --- Milestones ---------------------------------------------------------------

projectsRouter.post('/:id/milestones', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter) return notFound(res);
  const parsed = milestoneCreateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const actor = await currentActor(res);
  const milestone: Milestone = { id: `ms-${new ObjectId().toHexString()}`, ...parsed.data, done: false, doneAt: null };
  const { projects } = await collections();
  const doc = await projects.findOneAndUpdate(
    { $and: [filter, { [`milestones.${MAX_MILESTONES - 1}`]: { $exists: false } }] },
    {
      $push: { milestones: milestone, ...logged(entry(actor, `added the milestone ${quote(milestone.title)}`)) },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' }
  );
  if (!doc) {
    const exists = await projects.findOne(filter, { projection: { _id: 1 } });
    if (!exists) return notFound(res);
    res.status(400).json({ error: `A project can have up to ${MAX_MILESTONES} milestones.` });
    return;
  }
  res.status(201).json({ project: await fullView(doc, actor._id) });
});

projectsRouter.patch('/:id/milestones/:milestoneId', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter) return notFound(res);
  const parsed = milestoneUpdateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);
  const actor = await currentActor(res);
  const { projects } = await collections();
  const current = await projects.findOne(filter);
  if (!current) return notFound(res);
  const milestone = current.milestones.find((m) => m.id === req.params.milestoneId);
  if (!milestone) {
    res.status(404).json({ error: MILESTONE_GONE });
    return;
  }

  const changes = parsed.data;
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(changes)) set[`milestones.$[m].${key}`] = value;
  const title = changes.title ?? milestone.title;
  let text = `updated the milestone ${quote(title)}`;
  if (changes.done !== undefined && changes.done !== milestone.done) {
    set['milestones.$[m].doneAt'] = changes.done ? new Date().toISOString() : null;
    text = changes.done ? `reached the milestone ${quote(title)}` : `reopened the milestone ${quote(title)}`;
  }
  const doc = await projects.findOneAndUpdate(
    { $and: [filter, { 'milestones.id': milestone.id }] },
    { $set: set, $push: logged(entry(actor, text)) },
    { arrayFilters: [{ 'm.id': milestone.id }], returnDocument: 'after' }
  );
  if (!doc) {
    res.status(404).json({ error: MILESTONE_GONE });
    return;
  }
  res.json({ project: await fullView(doc, actor._id) });
});

// Deleting a milestone keeps its cards; they just no longer belong to it
projectsRouter.delete('/:id/milestones/:milestoneId', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter) return notFound(res);
  const actor = await currentActor(res);
  const { projects } = await collections();
  const current = await projects.findOne(filter);
  if (!current) return notFound(res);
  const milestone = current.milestones.find((m) => m.id === req.params.milestoneId);
  if (!milestone) {
    res.status(404).json({ error: MILESTONE_GONE });
    return;
  }
  const doc = await projects.findOneAndUpdate(
    filter,
    {
      $pull: { milestones: { id: milestone.id } },
      $set: { 'tasks.$[t].milestoneId': null, updatedAt: new Date() },
      $push: logged(entry(actor, `deleted the milestone ${quote(milestone.title)}`)),
    },
    { arrayFilters: [{ 't.milestoneId': milestone.id }], returnDocument: 'after' }
  );
  if (!doc) return notFound(res);
  res.json({ project: await fullView(doc, actor._id) });
});

// --- Collaborators --------------------------------------------------------------

/** Friends of the owner, plus teammates from the linked hackathon, who are not on the project yet */
async function candidatesFor(doc: ProjectDoc): Promise<ProjectCandidate[]> {
  const onProject = new Set([...teamIds(doc), ...(doc.pendingInvites ?? []).map((i) => i.userId.toHexString())]);
  const friends = await friendsOf(doc.ownerId);
  const teammates = doc.hackathonId ? await hackathonTeammates(doc.hackathonId, doc.ownerId) : [];
  const list = new Map<string, ProjectCandidate>();
  for (const t of teammates) {
    list.set(t._id.toHexString(), {
      userId: t._id.toHexString(),
      name: t.name,
      username: t.handle ?? '',
      profilePublic: Boolean(t.profilePublic),
      source: 'teammate',
    });
  }
  for (const { since: _since, ...f } of friends) if (!list.has(f.userId)) list.set(f.userId, { ...f, source: 'friend' });
  return [...list.values()].filter((p) => !onProject.has(p.userId)).sort((a, b) => a.name.localeCompare(b.name));
}

projectsRouter.get('/:id/candidates', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  const { projects } = await collections();
  const doc = filter && (await projects.findOne(filter));
  if (!doc) return notFound(res);
  if (!doc.ownerId.equals(currentUserId(res))) {
    res.json({ people: [] });
    return;
  }
  res.json({ people: await candidatesFor(doc) });
});

/**
 * Invite someone to the project. Friends and teammates from the linked hackathon get the invitation now;
 * anyone else (by username) gets a friend request first, and the invitation waits until they accept it
 */
projectsRouter.post('/:id/members', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter) return notFound(res);
  const parsed = memberSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error);

  const actor = await currentActor(res);
  const { projects, users } = await collections();
  const current = await projects.findOne(filter);
  if (!current) return notFound(res);
  if (!current.ownerId.equals(actor._id)) {
    res.status(403).json({ error: OWNER_ONLY });
    return;
  }
  if (actor.isDemo) {
    res.status(403).json({ error: 'Demo accounts cannot invite people. Create an account to work on projects together.' });
    return;
  }
  const target =
    'userId' in parsed.data
      ? await users.findOne({ _id: new ObjectId(parsed.data.userId), isDemo: { $ne: true } }, { projection: { name: 1, handle: 1 } })
      : await users.findOne({ handle: parsed.data.username, isDemo: { $ne: true } }, { projection: { name: 1, handle: 1 } });
  if (!target) {
    res.status(404).json({ error: 'username' in parsed.data ? `No one has the username @${parsed.data.username}.` : 'That person was not found.' });
    return;
  }
  if (target._id.equals(actor._id)) {
    res.status(400).json({ error: "That's you. You own this project." });
    return;
  }
  if (teamIds(current).has(target._id.toHexString())) {
    res.status(409).json({ error: `${target.name} is already on this project.` });
    return;
  }
  if ((current.pendingInvites ?? []).some((i) => i.userId.equals(target._id))) {
    res.status(409).json({ error: `${target.name} is already invited.` });
    return;
  }
  if (current.memberIds.length + (current.pendingInvites ?? []).length >= MAX_MEMBERS) {
    res.status(400).json({ error: `A project can have up to ${MAX_MEMBERS} collaborators, counting invitations.` });
    return;
  }
  const teammate =
    current.hackathonId && (await hackathonTeammates(current.hackathonId, actor._id)).some((t) => t._id.equals(target._id));
  let known = Boolean(teammate) || (await areFriends(actor._id, target._id));
  if (!known && 'userId' in parsed.data) {
    res.status(403).json({ error: 'You can add people on your friend list, or teammates from the linked hackathon.' });
    return;
  }
  // A stranger gets a friend request first; if they had already asked you, you are friends straight away
  if (!known) known = (await sendFriendRequest(actor._id, target._id)) === 'accepted';

  const doc = await projects.findOneAndUpdate(
    { $and: [filter, { 'pendingInvites.userId': { $ne: target._id }, memberIds: { $ne: target._id } }] },
    {
      $push: {
        pendingInvites: { userId: target._id, invitedBy: actor._id, invitedAt: new Date(), waitingForFriendship: !known },
        ...logged(entry(actor, `invited ${target.name}${known ? '' : ' (after they accept a friend request)'}`)),
      },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' }
  );
  if (!doc) {
    res.status(409).json({ error: `${target.name} is already on this project or invited.` });
    return;
  }
  res.status(201).json({ project: await fullView(doc, actor._id), awaitingFriend: !known });
});

// Withdraw an invitation (owner only)
projectsRouter.delete('/:id/invites/:userId', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter || !ObjectId.isValid(req.params.userId)) return notFound(res);
  const actor = await currentActor(res);
  const { projects } = await collections();
  const current = await projects.findOne(filter);
  if (!current) return notFound(res);
  if (!current.ownerId.equals(actor._id)) {
    res.status(403).json({ error: OWNER_ONLY });
    return;
  }
  const targetId = new ObjectId(req.params.userId);
  if (!(current.pendingInvites ?? []).some((i) => i.userId.equals(targetId))) {
    res.status(404).json({ error: 'That invitation no longer exists.' });
    return;
  }
  const people = await peopleOf([current]);
  const doc = await projects.findOneAndUpdate(
    { _id: current._id },
    {
      $pull: { pendingInvites: { userId: targetId } },
      $push: logged(entry(actor, `withdrew the invitation to ${people.get(targetId.toHexString())?.name ?? 'someone'}`)),
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' }
  );
  res.json({ project: await fullView(doc!, actor._id) });
});

// The owner can remove anyone; a collaborator can remove only themselves (leave). Their cards become unassigned
projectsRouter.delete('/:id/members/:userId', async (req, res) => {
  const filter = accessibleById(req.params.id, res);
  if (!filter || !ObjectId.isValid(req.params.userId)) return notFound(res);
  const actor = await currentActor(res);
  const { projects, users } = await collections();
  const current = await projects.findOne(filter);
  if (!current) return notFound(res);

  const targetId = new ObjectId(req.params.userId);
  const isSelf = targetId.equals(actor._id);
  if (current.ownerId.equals(targetId)) {
    res.status(400).json({ error: 'The owner cannot be removed from the project.' });
    return;
  }
  if (!current.ownerId.equals(actor._id) && !isSelf) {
    res.status(403).json({ error: OWNER_ONLY });
    return;
  }
  if (!current.memberIds.some((id) => id.equals(targetId))) {
    res.status(404).json({ error: 'That person is no longer on the project.' });
    return;
  }
  const target = await users.findOne({ _id: targetId }, { projection: { name: 1 } });
  const doc = await projects.findOneAndUpdate(
    { _id: current._id },
    {
      $pull: { memberIds: targetId, members: { userId: targetId } },
      $set: { 'tasks.$[t].assigneeId': null, 'tasks.$[t].assignedBy': null, 'tasks.$[t].assignedAt': null, updatedAt: new Date() },
      $push: logged(entry(actor, isSelf ? 'left the project' : `removed ${target?.name ?? 'a collaborator'} from the project`)),
    },
    { arrayFilters: [{ 't.assigneeId': targetId.toHexString() }], returnDocument: 'after' }
  );
  if (isSelf) await users.updateOne({ _id: actor._id }, { $pull: { profileProjectIds: current._id } });
  res.json({ project: isSelf || !doc ? null : await fullView(doc, actor._id), left: isSelf });
});
