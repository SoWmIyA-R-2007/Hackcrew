import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type {
  HackathonResult,
  HackathonView,
  Milestone,
  ProjectActivity,
  ProjectGitHub,
  ProjectLinks,
  ProjectStatus,
  ProjectTask,
  ReminderSettings,
  SubmissionLinks,
  TaskView,
} from '../../client/src/lib/types.js';

export interface UserDoc {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash?: string;
  // True once the person has proven they own the email (verification link, password reset or Google)
  emailVerified?: boolean;
  // Bumped to sign out every existing session for the account
  sessionVersion?: number;
  googleId?: string;
  avatarUrl?: string;
  // Notifications generated before this time count as read
  notificationsReadAt?: Date;
  // The username: unique, lower case, also the public profile address /u/<handle>
  handle?: string;
  // The public profile is private unless profilePublic is true
  profilePublic?: boolean;
  bio?: string;
  hiddenHackathonIds?: ObjectId[];
  // Projects are left off the public profile unless listed here
  profileProjectIds?: ObjectId[];
  // Profile links by platform (see social-links.ts), stored as full https URLs
  links?: Record<string, string>;
  // Demo accounts are throwaway: MongoDB deletes them (and their hackathons) at expiresAt
  isDemo?: boolean;
  expiresAt?: Date;
  createdAt: Date;
}

// Hackathons are stored as one document each, with tasks and team embedded
export type HackathonDoc = Omit<HackathonView, 'id' | 'role' | 'version'> & {
  _id: ObjectId;
  ownerId: ObjectId;
  // Accounts that accepted an invite and can view and edit the hackathon
  memberIds: ObjectId[];
  // Incremented on every edit; an update must name the version it started from
  version: number;
  // Reminder emails already sent, as "<deadline ISO>|<days before>"
  remindersSent?: string[];
  lastTeamEmailAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
};

export interface InviteDoc {
  _id: ObjectId;
  hackathonId: ObjectId;
  operativeId: string;
  email: string;
  // Set when a friend was invited by account: they can accept in the app without the email link
  inviteeUserId?: ObjectId;
  // Invited by username before being friends: hidden from them until they accept the friend request
  waitingForFriendship?: boolean;
  invitedBy: ObjectId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface ProjectInviteDoc {
  userId: ObjectId;
  invitedBy: ObjectId;
  invitedAt: Date;
  // Not friends yet: the invitee sees it only after accepting the inviter's friend request
  waitingForFriendship: boolean;
}

/** A project with its board, milestones and history embedded */
export interface ProjectDoc {
  _id: ObjectId;
  ownerId: ObjectId;
  // Collaborators (not the owner), with who added them; memberIds mirrors it for access checks
  memberIds: ObjectId[];
  members: { userId: ObjectId; addedBy: ObjectId; addedAt: Date }[];
  // Invitations not yet accepted or declined
  pendingInvites?: ProjectInviteDoc[];
  title: string;
  tagline: string;
  description: string;
  status: ProjectStatus;
  hackathonId: ObjectId | null;
  techStack: string[];
  links: ProjectLinks;
  startDate: string | null;
  targetDate: string | null;
  tasks: ProjectTask[];
  milestones: Milestone[];
  // Newest last, capped so the document stays small
  activity: ProjectActivity[];
  // The last snapshot read from the GitHub repository in links.repoUrl
  github?: Omit<ProjectGitHub, 'url' | 'syncedAt'> & { syncedAt: Date | null };
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

/** A friend request, or a friendship once accepted. pairKey is the two ids sorted, so a pair exists once */
export interface FriendshipDoc {
  _id: ObjectId;
  requesterId: ObjectId;
  addresseeId: ObjectId;
  pairKey: string;
  status: 'pending' | 'accepted';
  createdAt: Date;
  acceptedAt?: Date;
}

export const friendPairKey = (a: ObjectId, b: ObjectId) => [a.toHexString(), b.toHexString()].sort().join(':');

export const DEFAULT_SUBMISSION: SubmissionLinks = { repoUrl: '', demoVideoUrl: '', deckUrl: '', projectUrl: '' };
export const DEFAULT_RESULT: HackathonResult = { outcome: 'pending', placement: '', prize: '', notes: '' };
export const DEFAULT_REMINDERS: ReminderSettings = { enabled: true, daysBefore: [7, 3, 1] };

/** Weighted share of completed tasks, as a whole percentage */
export function computeCompletion(tasks: Pick<TaskView, 'completed' | 'weight'>[]) {
  const total = tasks.reduce((sum, t) => sum + t.weight, 0);
  const done = tasks.filter((t) => t.completed).reduce((sum, t) => sum + t.weight, 0);
  return total ? Math.round((done / total) * 100) : 0;
}

/** Access filter: the hackathon's owner or one of its members */
export function accessFilter(userId: ObjectId) {
  return { $or: [{ ownerId: userId }, { memberIds: userId }] };
}

export function toHackathonView(doc: HackathonDoc, viewerId?: ObjectId): HackathonView {
  // Older documents may lack newer fields or still carry removed ones (notifications, rules)
  const {
    _id,
    ownerId,
    memberIds: _memberIds,
    version,
    remindersSent: _remindersSent,
    lastTeamEmailAt: _lastTeamEmailAt,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    expiresAt: _expiresAt,
    ...rest
  } = doc;
  const { notifications: _n, rules: _r, ...fields } = rest as typeof rest & { notifications?: unknown; rules?: unknown };
  return {
    ...fields,
    id: _id.toHexString(),
    registrationDeadline: fields.registrationDeadline ?? null,
    shortlistDate: fields.shortlistDate ?? null,
    finalPresentationDate: fields.finalPresentationDate ?? null,
    submission: { ...DEFAULT_SUBMISSION, ...fields.submission },
    result: { ...DEFAULT_RESULT, ...fields.result },
    reminders: { ...DEFAULT_REMINDERS, ...fields.reminders },
    operatives: (fields.operatives ?? []).map((o) => ({
      ...o,
      userId: o.userId ?? null,
      invitePending: Boolean(o.invitePending),
      awaitingFriend: Boolean(o.awaitingFriend),
      joinedAt: o.joinedAt ?? null,
    })),
    tasks: (fields.tasks ?? []).map((t) => ({ ...t, assigneeId: t.assigneeId ?? null, dueDate: t.dueDate ?? null })),
    role: viewerId && !ownerId.equals(viewerId) ? 'member' : 'owner',
    version: version ?? 0,
  };
}

export function toPublicUser(user: UserDoc) {
  return {
    id: user._id.toHexString(),
    email: user.email,
    name: user.name,
    username: user.handle ?? null,
    avatarUrl: user.avatarUrl ?? null,
    hasPassword: Boolean(user.passwordHash),
    hasGoogle: Boolean(user.googleId),
    emailVerified: Boolean(user.emailVerified),
    isDemo: Boolean(user.isDemo),
    createdAt: user.createdAt.toISOString(),
    expiresAt: user.expiresAt?.toISOString() ?? null,
  };
}

export type HackathonFields = Omit<HackathonView, 'id' | 'code' | 'role' | 'version'>;

/** New hackathon documents for a user, in the given order (newest first when listed) */
export function toHackathonDocs(list: HackathonFields[], ownerId: ObjectId, expiresAt?: Date): HackathonDoc[] {
  const now = Date.now();
  return list.map((h, i) => {
    const _id = new ObjectId();
    const createdAt = new Date(now - i);
    return {
      ...h,
      completion: computeCompletion(h.tasks),
      _id,
      code: generateHackathonCode(_id),
      ownerId,
      memberIds: [],
      version: 0,
      createdAt,
      updatedAt: createdAt,
      ...(expiresAt ? { expiresAt } : {}),
    };
  });
}

export const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date');
const optionalDate = isoDate.nullable().default(null);
// Only http(s) links, so nothing like javascript: can be stored and rendered as a link
export const link = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Links must start with http:// or https://');

const taskSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(300),
  completed: z.boolean(),
  weight: z.number().int().min(1).max(3),
  assigneeId: z.string().max(100).nullable().default(null),
  assigneeName: z.string().max(200),
  assigneeAvatar: z.string().max(2000),
  dueDate: optionalDate,
});

// userId, invitePending and joinedAt are managed by the server, so clients cannot set them
const operativeSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().max(320),
  role: z.string().max(100),
  avatar: z.string().max(2000),
});

const submissionSchema = z.object({
  repoUrl: link.default(''),
  demoVideoUrl: link.default(''),
  deckUrl: link.default(''),
  projectUrl: link.default(''),
});

const resultSchema = z.object({
  outcome: z.enum(['pending', 'participated', 'shortlisted', 'finalist', 'winner']).default('pending'),
  placement: z.string().trim().max(100).default(''),
  prize: z.string().trim().max(200).default(''),
  notes: z.string().max(2000).default(''),
});

const remindersSchema = z.object({
  enabled: z.boolean().default(true),
  daysBefore: z
    .array(z.number().int().min(1).max(30))
    .max(5)
    .default([7, 3, 1])
    .transform((days) => [...new Set(days)].sort((a, b) => b - a)),
});

const editableFields = {
  title: z.string().trim().min(1).max(200),
  teamName: z.string().trim().min(1).max(200),
  domain: z.string().trim().max(200),
  psId: z.string().trim().max(100),
  problemStatement: z.string().max(10000),
  status: z.enum(['not_started', 'in_progress', 'submitted', 'completed']),
  priority: z.enum(['high', 'medium', 'low']),
  completion: z.number().min(0).max(100),
  timeRemaining: z.string().max(100).default(''),
  kickoffDate: isoDate,
  registrationDeadline: optionalDate,
  submissionDeadline: isoDate.nullable(),
  shortlistDate: optionalDate,
  finalPresentationDate: optionalDate,
  bannerImage: z.string().max(2000).default(''),
  mode: z.enum(['online', 'offline', 'hybrid']).nullable(),
  websiteLink: link.nullable().transform((v) => v || null),
  tasks: z.array(taskSchema).max(500),
  submission: submissionSchema.default(DEFAULT_SUBMISSION),
  result: resultSchema.default(DEFAULT_RESULT),
  reminders: remindersSchema.default(DEFAULT_REMINDERS),
};

/** A new hackathon (create and import); id, code and ownership are assigned by the server */
export const hackathonInputSchema = z.object({ ...editableFields, operatives: z.array(operativeSchema).max(50) });

/**
 * An edit. The team list is left out (it changes only through the team endpoints), and version must
 * match the stored one so two people editing at once cannot silently overwrite each other.
 */
export const hackathonUpdateSchema = z.object({ ...editableFields, version: z.number().int().min(0) });

export function generateHackathonCode(id: ObjectId): string {
  return `#HCK-${id.toHexString().slice(-4).toUpperCase()}`;
}
