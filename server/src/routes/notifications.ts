import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '../db.js';
import { currentUserId, requireUser } from '../auth-middleware.js';
import { accessFilter, toHackathonView } from '../models.js';
import { heldInviteLabels } from '../held-invites.js';
import type { AppNotification } from '../../../client/src/lib/types.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireUser('Not signed in'));

const DAY = 24 * 60 * 60 * 1000;

function relative(ms: number, now: number) {
  const days = Math.round((ms - now) / DAY);
  if (days <= 0) return Math.round((ms - now) / (60 * 60 * 1000)) <= 1 ? 'within the hour' : 'today';
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

const KEY_DATES = [
  ['registrationDeadline', 'Registration closes'],
  ['shortlistDate', 'Shortlist is announced'],
  ['finalPresentationDate', 'Final presentation'],
] as const;

// Notifications are worked out from current data each time, so they always match deadlines and tasks
notificationsRouter.get('/', async (_req, res) => {
  const userId = currentUserId(res);
  const me = userId.toHexString();
  const now = Date.now();
  const { users, hackathons } = await collections();
  const user = await users.findOne({ _id: userId }, { projection: { notificationsReadAt: 1 } });
  const readAt = user?.notificationsReadAt?.getTime() ?? 0;
  const docs = await hackathons.find(accessFilter(userId)).toArray();

  const items: Omit<AppNotification, 'unread'>[] = [];
  for (const doc of docs) {
    const h = toHackathonView(doc);
    const finished = h.status === 'submitted' || h.status === 'completed';

    if (h.submissionDeadline && !finished) {
      const due = new Date(h.submissionDeadline).getTime();
      const open = h.tasks.filter((t) => !t.completed).length;
      const missing = Object.values(h.submission).filter((v) => !v).length;
      if (due < now) {
        items.push({
          id: `overdue:${h.id}:${h.submissionDeadline}`,
          kind: 'urgent',
          title: `${h.title} passed its deadline`,
          description: 'It is not marked as submitted. Mark it submitted, or update the deadline if it moved.',
          time: new Date(due).toISOString(),
          hackathonId: h.id,
        });
      } else if (due - now <= 7 * DAY) {
        items.push({
          id: `due-soon:${h.id}:${h.submissionDeadline}`,
          kind: 'urgent',
          title: `${h.title} is due ${relative(due, now)}`,
          description: [
            open ? `${open} open ${open === 1 ? 'task' : 'tasks'}` : 'All tasks done',
            missing ? `${missing} submission ${missing === 1 ? 'link' : 'links'} missing` : 'all submission links added',
          ].join(', ') + '.',
          // Appears a week out, the same time as the first reminder email
          time: new Date(due - 7 * DAY).toISOString(),
          hackathonId: h.id,
        });
      }
    }

    for (const [field, label] of KEY_DATES) {
      const value = h[field];
      if (!value) continue;
      const at = new Date(value).getTime();
      if (at > now && at - now <= 2 * DAY) {
        items.push({
          id: `${field}:${h.id}:${value}`,
          kind: 'system',
          title: `${label} for ${h.title} ${relative(at, now)}`,
          description: new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC',
          time: new Date(at - 2 * DAY).toISOString(),
          hackathonId: h.id,
        });
      }
    }

    const mine = new Set(h.operatives.filter((o) => o.userId === me).map((o) => o.id));
    for (const t of h.tasks) {
      if (t.completed || !t.dueDate || !t.assigneeId || !mine.has(t.assigneeId)) continue;
      const due = new Date(t.dueDate).getTime();
      if (due - now <= DAY) {
        items.push({
          id: `task:${h.id}:${t.id}:${t.dueDate}`,
          kind: 'team',
          title: due < now ? `Your task is overdue: ${t.title}` : `Your task is due ${relative(due, now)}: ${t.title}`,
          description: `Part of ${h.title}.`,
          time: new Date(Math.min(due, due - DAY)).toISOString(),
          hackathonId: h.id,
        });
      }
    }

    for (const o of h.operatives) {
      if (!o.joinedAt || o.userId === me || o.userId === doc.ownerId.toHexString()) continue;
      const joined = new Date(o.joinedAt).getTime();
      if (now - joined <= 14 * DAY) {
        items.push({
          id: `joined:${h.id}:${o.id}`,
          kind: 'team',
          title: `${o.name} joined team ${h.teamName}`,
          description: `They can now see and edit ${h.title}.`,
          time: o.joinedAt,
          hackathonId: h.id,
        });
      }
    }
  }

  // Friend requests and team invites from friends lead to the Friends page
  const { friendships, invites } = await collections();
  const recentCutoff = new Date(now - 14 * DAY);
  const [incoming, accepted, teamInvites] = await Promise.all([
    friendships.find({ addresseeId: userId, status: 'pending' }).toArray(),
    friendships.find({ requesterId: userId, status: 'accepted', acceptedAt: { $gte: recentCutoff } }).toArray(),
    invites.find({ inviteeUserId: userId, waitingForFriendship: { $ne: true }, expiresAt: { $gt: new Date(now) } }).toArray(),
  ]);
  const peopleIds = [
    ...incoming.map((f) => f.requesterId),
    ...accepted.map((f) => f.addresseeId),
    ...teamInvites.map((i) => i.invitedBy),
  ];
  const people = new Map(
    (await users.find({ _id: { $in: peopleIds } }, { projection: { name: 1, handle: 1 } }).toArray()).map((p) => [
      p._id.toHexString(),
      p,
    ])
  );
  const who = (id: ObjectId) => {
    const p = people.get(id.toHexString());
    return p ? `${p.name}${p.handle ? ` (@${p.handle})` : ''}` : 'Someone';
  };
  for (const f of incoming) {
    const held = await heldInviteLabels(f.requesterId, userId);
    items.push({
      id: `friend-request:${f._id.toHexString()}`,
      kind: 'team',
      title: `${who(f.requesterId)} sent you a friend request`,
      description: held.length
        ? `They also invited you to ${held.join(' and ')}. Accept the request to see the invitation.`
        : 'Accept it to invite each other to teams with one click.',
      time: f.createdAt.toISOString(),
      hackathonId: null,
      link: '/friends',
    });
  }
  for (const f of accepted) {
    items.push({
      id: `friend-accepted:${f._id.toHexString()}`,
      kind: 'team',
      title: `${who(f.addresseeId)} accepted your friend request`,
      description: 'You can now invite them to your teams with one click.',
      time: f.acceptedAt!.toISOString(),
      hackathonId: null,
      link: '/friends',
    });
  }
  for (const i of teamInvites) {
    const h = docs.find((d) => d._id.equals(i.hackathonId)) ?? (await hackathons.findOne({ _id: i.hackathonId }));
    if (!h) continue;
    items.push({
      id: `team-invite:${i._id.toHexString()}`,
      kind: 'team',
      title: `${who(i.invitedBy)} invited you to team ${h.teamName}`,
      description: `Join to work on ${h.title} together.`,
      time: i.createdAt.toISOString(),
      hackathonId: null,
      link: '/friends',
    });
  }

  // Projects: being added, cards assigned to you by others, your cards due soon, milestones coming up
  const { projects } = await collections();
  const projectDocs = await projects.find(accessFilter(userId)).toArray();
  const invitedTo = await projects
    .find({ pendingInvites: { $elemMatch: { userId, waitingForFriendship: false } } }, { projection: { title: 1, pendingInvites: 1 } })
    .toArray();
  const actorIds = [
    ...invitedTo.flatMap((p) => p.pendingInvites!.map((i) => i.invitedBy)),
    ...projectDocs.flatMap((p) => [
      ...p.members.map((m) => m.userId),
      ...p.tasks.flatMap((t) => (t.assignedBy && ObjectId.isValid(t.assignedBy) ? [new ObjectId(t.assignedBy)] : [])),
    ]),
  ];
  const projectPeople = new Map<string, string>(
    (await users.find({ _id: { $in: actorIds } }, { projection: { name: 1 } }).toArray()).map((p) => [
      p._id.toHexString(),
      p.name,
    ])
  );
  const nameOf = (id: string) => projectPeople.get(id) ?? 'Someone';
  for (const p of invitedTo) {
    const invite = p.pendingInvites!.find((i) => i.userId.equals(userId))!;
    items.push({
      id: `project-invite:${p._id.toHexString()}:${invite.invitedAt.getTime()}`,
      kind: 'team',
      title: `${nameOf(invite.invitedBy.toHexString())} invited you to the project ${p.title}`,
      description: 'Join from your Friends page to see the board and take cards.',
      time: invite.invitedAt.toISOString(),
      hackathonId: null,
      link: '/friends',
    });
  }
  for (const p of projectDocs) {
    const id = p._id.toHexString();
    const link = `/projects/${id}`;
    const active = p.status !== 'shipped' && p.status !== 'archived';
    // People who accepted an invitation you sent
    for (const m of p.members) {
      if (!m.addedBy.equals(userId) || m.userId.equals(userId) || now - m.addedAt.getTime() > 14 * DAY) continue;
      items.push({
        id: `project-joined:${id}:${m.userId.toHexString()}`,
        kind: 'team',
        title: `${nameOf(m.userId.toHexString())} joined your project ${p.title}`,
        description: 'They can now move cards and take tasks.',
        time: m.addedAt.toISOString(),
        hackathonId: null,
        link,
      });
    }
    for (const t of p.tasks) {
      if (t.assigneeId !== me || t.column === 'done') continue;
      if (t.assignedBy && t.assignedBy !== me && t.assignedAt && now - Date.parse(t.assignedAt) <= 7 * DAY) {
        items.push({
          id: `project-assigned:${id}:${t.id}:${t.assignedAt}`,
          kind: 'team',
          title: `${nameOf(t.assignedBy)} assigned you: ${t.title}`,
          description: `A card on ${p.title}.`,
          time: t.assignedAt,
          hackathonId: null,
          link,
        });
      }
      if (!t.dueDate) continue;
      const due = Date.parse(t.dueDate);
      if (due - now <= DAY) {
        items.push({
          id: `project-task:${id}:${t.id}:${t.dueDate}`,
          kind: due < now ? 'urgent' : 'team',
          title: due < now ? `Your card is overdue: ${t.title}` : `Your card is due ${relative(due, now)}: ${t.title}`,
          description: `On ${p.title}.`,
          time: new Date(due - DAY).toISOString(),
          hackathonId: null,
          link,
        });
      }
    }
    if (!active) continue;
    for (const m of p.milestones) {
      if (m.done || !m.dueDate) continue;
      const due = Date.parse(m.dueDate);
      if (due > now && due - now <= 2 * DAY) {
        const open = p.tasks.filter((t) => t.milestoneId === m.id && t.column !== 'done').length;
        items.push({
          id: `milestone:${id}:${m.id}:${m.dueDate}`,
          kind: 'system',
          title: `Milestone ${m.title} on ${p.title} is due ${relative(due, now)}`,
          description: open ? `${open} open ${open === 1 ? 'card' : 'cards'} left for it.` : 'Every card for it is done.',
          time: new Date(due - 2 * DAY).toISOString(),
          hackathonId: null,
          link,
        });
      }
    }
  }

  const notifications: AppNotification[] = items
    .filter((n) => new Date(n.time).getTime() <= now)
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 40)
    .map((n) => ({ ...n, unread: new Date(n.time).getTime() > readAt }));
  res.json({ notifications });
});

notificationsRouter.post('/read-all', async (_req, res) => {
  const { users } = await collections();
  await users.updateOne({ _id: currentUserId(res) }, { $set: { notificationsReadAt: new Date() } });
  res.json({ ok: true });
});
