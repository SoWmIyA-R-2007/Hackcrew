import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '../db.js';
import { currentUserId, requireUser } from '../auth-middleware.js';
import { hashToken } from '../tokens.js';
import type { HackathonDoc, InviteDoc, UserDoc } from '../models.js';
import type { TeamInvite } from '../../../client/src/lib/types.js';

export const invitesRouter = Router();

const INVALID = 'This invite link is invalid or has expired. Ask your teammate to invite you again.';
const GONE = 'This invite is no longer available. It may have expired or been withdrawn.';
const DEMO = 'Demo accounts cannot join teams. Create an account to accept the invite.';

async function findInvite(token: string) {
  const { invites, hackathons, users } = await collections();
  const invite = await invites.findOne({
    tokenHash: hashToken(token),
    waitingForFriendship: { $ne: true },
    expiresAt: { $gt: new Date() },
  });
  if (!invite) return null;
  const hackathon = await hackathons.findOne({ _id: invite.hackathonId });
  if (!hackathon || !hackathon.operatives.some((o) => o.id === invite.operativeId)) return null;
  const inviter = await users.findOne({ _id: invite.invitedBy }, { projection: { name: 1 } });
  return { invite, hackathon, inviterName: inviter?.name ?? 'A teammate' };
}

/** Puts the user on the team in the invited person's place and uses up the invite */
async function joinTeam(invite: InviteDoc, hackathon: HackathonDoc, user: UserDoc) {
  const { hackathons, invites } = await collections();
  const alreadyIn = hackathon.ownerId.equals(user._id) || hackathon.memberIds.some((id) => id.equals(user._id));
  if (!alreadyIn) {
    await hackathons.updateOne(
      { _id: hackathon._id },
      {
        $addToSet: { memberIds: user._id },
        $set: {
          'operatives.$[op].userId': user._id.toHexString(),
          'operatives.$[op].invitedUserId': null,
          'operatives.$[op].invitePending': false,
          'operatives.$[op].awaitingFriend': false,
          'operatives.$[op].joinedAt': new Date().toISOString(),
          'operatives.$[op].name': user.name,
          updatedAt: new Date(),
        },
        $inc: { version: 1 },
      },
      { arrayFilters: [{ 'op.id': invite.operativeId }] }
    );
  }
  await invites.deleteOne({ _id: invite._id });
  return { hackathonId: hackathon._id.toHexString(), alreadyMember: alreadyIn };
}

/** An invite addressed to the signed-in user's account (sent to a friend), if it is still valid */
async function findMyInvite(id: string, userId: ObjectId) {
  if (!ObjectId.isValid(id)) return null;
  const { invites, hackathons } = await collections();
  const invite = await invites.findOne({
    _id: new ObjectId(id),
    inviteeUserId: userId,
    waitingForFriendship: { $ne: true },
    expiresAt: { $gt: new Date() },
  });
  if (!invite) return null;
  const hackathon = await hackathons.findOne({ _id: invite.hackathonId });
  if (!hackathon || !hackathon.operatives.some((o) => o.id === invite.operativeId)) return null;
  return { invite, hackathon };
}

// Team invites waiting for the signed-in user (from friends), newest first
invitesRouter.get('/mine', requireUser('Not signed in'), async (_req, res) => {
  const userId = currentUserId(res);
  const { invites, hackathons, users } = await collections();
  const mine = await invites
    .find({ inviteeUserId: userId, waitingForFriendship: { $ne: true }, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .toArray();
  const docs = await hackathons.find({ _id: { $in: mine.map((i) => i.hackathonId) } }).toArray();
  const inviters = await users.find({ _id: { $in: mine.map((i) => i.invitedBy) } }, { projection: { name: 1 } }).toArray();
  const result: TeamInvite[] = mine.flatMap((invite) => {
    const h = docs.find((d) => d._id.equals(invite.hackathonId));
    const op = h?.operatives.find((o) => o.id === invite.operativeId);
    if (!h || !op) return [];
    return [
      {
        id: invite._id.toHexString(),
        hackathonId: h._id.toHexString(),
        hackathonTitle: h.title,
        teamName: h.teamName,
        role: op.role,
        invitedBy: inviters.find((u) => u._id.equals(invite.invitedBy))?.name ?? 'A teammate',
        createdAt: invite.createdAt.toISOString(),
      },
    ];
  });
  res.json({ invites: result });
});

// Accept a team invite from a friend with one click
invitesRouter.post('/by-id/:id/accept', requireUser('Not signed in'), async (req, res) => {
  const userId = currentUserId(res);
  const { users } = await collections();
  const user = await users.findOne({ _id: userId });
  if (!user || user.isDemo) {
    res.status(403).json({ error: DEMO });
    return;
  }
  const found = await findMyInvite(String(req.params.id), userId);
  if (!found) {
    res.status(404).json({ error: GONE });
    return;
  }
  res.json(await joinTeam(found.invite, found.hackathon, user));
});

// Decline a team invite from a friend: they come off the team list
invitesRouter.delete('/by-id/:id', requireUser('Not signed in'), async (req, res) => {
  const userId = currentUserId(res);
  const found = await findMyInvite(String(req.params.id), userId);
  if (!found) {
    res.status(404).json({ error: GONE });
    return;
  }
  const { hackathons, invites } = await collections();
  await hackathons.updateOne(
    { _id: found.hackathon._id },
    {
      $pull: { operatives: { id: found.invite.operativeId, invitePending: true } },
      $set: { updatedAt: new Date() },
      $inc: { version: 1 },
    }
  );
  await invites.deleteOne({ _id: found.invite._id });
  res.json({ ok: true });
});

// What the invite is for, shown before the person signs in
invitesRouter.get('/:token', async (req, res) => {
  const found = await findInvite(String(req.params.token));
  if (!found) {
    res.status(404).json({ error: INVALID });
    return;
  }
  res.json({
    hackathonTitle: found.hackathon.title,
    teamName: found.hackathon.teamName,
    inviterName: found.inviterName,
    email: found.invite.email,
  });
});

// Join the team from the emailed link with the signed-in account. The link is single use
invitesRouter.post('/:token/accept', requireUser('Sign in to accept the invite.'), async (req, res) => {
  const found = await findInvite(String(req.params.token));
  if (!found) {
    res.status(404).json({ error: INVALID });
    return;
  }
  const { users } = await collections();
  const user = await users.findOne({ _id: currentUserId(res) });
  if (!user || user.isDemo) {
    res.status(403).json({ error: DEMO });
    return;
  }
  const result = await joinTeam(found.invite, found.hackathon, user);
  // Opening the emailed link proves access to the invited address
  if (found.invite.email === user.email && !user.emailVerified) {
    await users.updateOne({ _id: user._id }, { $set: { emailVerified: true } });
  }
  res.json(result);
});
