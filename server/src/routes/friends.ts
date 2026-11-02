import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { collections } from '../db.js';
import { currentUserId, requireUser } from '../auth-middleware.js';
import { friendPairKey, type FriendshipDoc, type UserDoc } from '../models.js';
import { dropHeldInvites, heldInviteLabels, releaseHeldInvites } from '../held-invites.js';
import type { FriendsOverview, PersonSummary } from '../../../client/src/lib/types.js';

export const friendsRouter = Router();
friendsRouter.use(requireUser('Sign in to manage friends.'));

const DEMO_ERROR = 'Demo accounts cannot add friends. Create an account to build your friend list.';

const requestSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .max(31)
    .transform((v) => v.replace(/^@/, ''))
    .refine((v) => v.length > 0, 'Enter a username'),
});

const toPerson = (u: Pick<UserDoc, '_id' | 'name' | 'handle' | 'profilePublic'>): PersonSummary => ({
  userId: u._id.toHexString(),
  name: u.name,
  username: u.handle ?? '',
  profilePublic: Boolean(u.profilePublic),
});

const PERSON_FIELDS = { name: 1, handle: 1, profilePublic: 1 } as const;

async function me(userId: ObjectId) {
  const { users } = await collections();
  return users.findOne({ _id: userId });
}

/** Whether two accounts are friends (an accepted request either way) */
export async function areFriends(a: ObjectId, b: ObjectId) {
  const { friendships } = await collections();
  return Boolean(await friendships.findOne({ pairKey: friendPairKey(a, b), status: 'accepted' }, { projection: { _id: 1 } }));
}

/** Accepted friends of a user, with how long they have been friends */
export async function friendsOf(userId: ObjectId) {
  const { friendships, users } = await collections();
  const links = await friendships
    .find({ status: 'accepted', $or: [{ requesterId: userId }, { addresseeId: userId }] })
    .toArray();
  const otherId = (f: FriendshipDoc) => (f.requesterId.equals(userId) ? f.addresseeId : f.requesterId);
  const people = await users
    .find({ _id: { $in: links.map(otherId) }, isDemo: { $ne: true } }, { projection: PERSON_FIELDS })
    .toArray();
  const byId = new Map(people.map((p) => [p._id.toHexString(), p]));
  return links
    .flatMap((f) => {
      const person = byId.get(otherId(f).toHexString());
      return person ? [{ ...toPerson(person), since: (f.acceptedAt ?? f.createdAt).toISOString() }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Sends a friend request from one account to another. If the other person had already asked, this accepts
 * their request instead (and delivers any invitations held until then)
 */
export async function sendFriendRequest(fromId: ObjectId, toId: ObjectId) {
  const { friendships } = await collections();
  const pairKey = friendPairKey(fromId, toId);
  const existing = await friendships.findOne({ pairKey });
  if (existing?.status === 'accepted') return 'already-friends' as const;
  if (existing && existing.requesterId.equals(fromId)) return 'already-asked' as const;
  if (existing) {
    await friendships.updateOne({ _id: existing._id }, { $set: { status: 'accepted', acceptedAt: new Date() } });
    await releaseHeldInvites(fromId, toId);
    return 'accepted' as const;
  }
  try {
    await friendships.insertOne({
      _id: new ObjectId(),
      requesterId: fromId,
      addresseeId: toId,
      pairKey,
      status: 'pending',
      createdAt: new Date(),
    });
  } catch (err) {
    // Both sent a request at the same moment: the unique pair index keeps just one
    if ((err as { code?: number }).code !== 11000) throw err;
  }
  return 'pending' as const;
}

// Friends plus requests waiting either way
friendsRouter.get('/', async (_req, res) => {
  const userId = currentUserId(res);
  const { friendships, users } = await collections();
  const pending = await friendships
    .find({ status: 'pending', $or: [{ requesterId: userId }, { addresseeId: userId }] })
    .sort({ createdAt: -1 })
    .toArray();
  const others = pending.map((f) => (f.requesterId.equals(userId) ? f.addresseeId : f.requesterId));
  const people = new Map(
    (await users.find({ _id: { $in: others } }, { projection: PERSON_FIELDS }).toArray()).map((p) => [p._id.toHexString(), p])
  );
  const asRequest = (f: FriendshipDoc, other: ObjectId, heldInvites?: string[]) => {
    const person = people.get(other.toHexString());
    return person
      ? [{ id: f._id.toHexString(), person: toPerson(person), createdAt: f.createdAt.toISOString(), heldInvites }]
      : [];
  };
  const incoming = pending.filter((f) => f.addresseeId.equals(userId));
  // Invitations they sent along with the request, delivered once it is accepted
  const held = await Promise.all(incoming.map((f) => heldInviteLabels(f.requesterId, userId)));
  const overview: FriendsOverview = {
    friends: await friendsOf(userId),
    incoming: incoming.flatMap((f, i) => asRequest(f, f.requesterId, held[i])),
    outgoing: pending.filter((f) => f.requesterId.equals(userId)).flatMap((f) => asRequest(f, f.addresseeId)),
  };
  res.json(overview);
});

// Find people by the start of their username, to add as friends
friendsRouter.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9-]/g, '');
  if (q.length < 2) {
    res.json({ people: [] });
    return;
  }
  const userId = currentUserId(res);
  const { users } = await collections();
  const found = await users
    .find({ handle: { $regex: `^${q}` }, _id: { $ne: userId }, isDemo: { $ne: true } }, { projection: PERSON_FIELDS })
    .limit(6)
    .toArray();
  res.json({ people: found.map(toPerson) });
});

// Send a friend request. If they had already asked you, this accepts theirs instead
friendsRouter.post('/requests', async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const userId = currentUserId(res);
  if ((await me(userId))?.isDemo) {
    res.status(403).json({ error: DEMO_ERROR });
    return;
  }
  const { users } = await collections();
  const other = await users.findOne({ handle: parsed.data.username, isDemo: { $ne: true } }, { projection: PERSON_FIELDS });
  if (!other) {
    res.status(404).json({ error: `No one has the username @${parsed.data.username}.` });
    return;
  }
  if (other._id.equals(userId)) {
    res.status(400).json({ error: "That's you. Add someone else." });
    return;
  }

  const result = await sendFriendRequest(userId, other._id);
  if (result === 'already-friends') {
    res.status(409).json({ error: `You and @${other.handle} are already friends.` });
    return;
  }
  if (result === 'already-asked') {
    res.status(409).json({ error: `You already asked @${other.handle}. Waiting for them to accept.` });
    return;
  }
  res.status(result === 'accepted' ? 200 : 201).json({ status: result, person: toPerson(other) });
});

// Accept a request someone sent you
friendsRouter.post('/requests/:id/accept', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    res.status(404).json({ error: 'That friend request no longer exists.' });
    return;
  }
  const { friendships } = await collections();
  const accepted = await friendships.findOneAndUpdate(
    { _id: new ObjectId(req.params.id), addresseeId: currentUserId(res), status: 'pending' },
    { $set: { status: 'accepted', acceptedAt: new Date() } }
  );
  if (!accepted) {
    res.status(404).json({ error: 'That friend request no longer exists.' });
    return;
  }
  await releaseHeldInvites(accepted.requesterId, accepted.addresseeId);
  res.json({ ok: true });
});

// Decline a request sent to you, or cancel one you sent
friendsRouter.delete('/requests/:id', async (req, res) => {
  const userId = currentUserId(res);
  const { friendships } = await collections();
  const removed = ObjectId.isValid(req.params.id)
    ? await friendships.findOneAndDelete({
        _id: new ObjectId(req.params.id),
        status: 'pending',
        $or: [{ requesterId: userId }, { addresseeId: userId }],
      })
    : null;
  if (!removed) {
    res.status(404).json({ error: 'That friend request no longer exists.' });
    return;
  }
  // Invitations that were waiting on this request are withdrawn with it
  await dropHeldInvites(removed.requesterId, removed.addresseeId);
  res.json({ ok: true });
});

// Remove a friend
friendsRouter.delete('/:userId', async (req, res) => {
  const userId = currentUserId(res);
  const { friendships } = await collections();
  const result = ObjectId.isValid(req.params.userId)
    ? await friendships.deleteOne({ pairKey: friendPairKey(userId, new ObjectId(req.params.userId)), status: 'accepted' })
    : null;
  if (!result?.deletedCount) {
    res.status(404).json({ error: 'You are not friends with this person.' });
    return;
  }
  res.json({ ok: true });
});
