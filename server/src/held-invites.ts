import type { ObjectId } from 'mongodb';
import { collections } from './db.js';
import { inviteEmail } from './emails.js';
import { isDeliverable, sendMail } from './mailer.js';
import { hashToken, newRawToken } from './tokens.js';

/*
 * Inviting someone by username who is not a friend yet sends them a friend request, and the team or
 * project invitation waits ("held") until they accept it. Declining the request withdraws the invitation.
 */

const INVITE_DAYS = 14;
const directions = (a: ObjectId, b: ObjectId) => [
  [a, b],
  [b, a],
];

/** Delivers invitations held between two people who have just become friends */
export async function releaseHeldInvites(a: ObjectId, b: ObjectId) {
  const { invites, hackathons, projects, users } = await collections();
  for (const [inviter, invitee] of directions(a, b)) {
    const held = await invites.find({ invitedBy: inviter, inviteeUserId: invitee, waitingForFriendship: true }).toArray();
    if (held.length > 0) {
      const [from, to] = await Promise.all([
        users.findOne({ _id: inviter }, { projection: { name: 1 } }),
        users.findOne({ _id: invitee }, { projection: { email: 1 } }),
      ]);
      for (const invite of held) {
        // The emailed link needs a fresh token: only hashes are stored
        const token = newRawToken();
        const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
        await invites.updateOne(
          { _id: invite._id },
          { $set: { tokenHash: hashToken(token), expiresAt, createdAt: new Date() }, $unset: { waitingForFriendship: '' } }
        );
        const hackathon = await hackathons.findOneAndUpdate(
          { _id: invite.hackathonId },
          { $set: { 'operatives.$[op].awaitingFriend': false, updatedAt: new Date() }, $inc: { version: 1 } },
          { arrayFilters: [{ 'op.id': invite.operativeId }], returnDocument: 'after' }
        );
        if (hackathon && to && isDeliverable(to.email)) {
          await sendMail(inviteEmail(to.email, from?.name ?? 'A teammate', hackathon, token));
        }
      }
    }
    await projects.updateMany(
      { pendingInvites: { $elemMatch: { userId: invitee, invitedBy: inviter, waitingForFriendship: true } } },
      { $set: { 'pendingInvites.$[i].waitingForFriendship': false, 'pendingInvites.$[i].invitedAt': new Date() } },
      { arrayFilters: [{ 'i.userId': invitee, 'i.invitedBy': inviter }] }
    );
  }
}

/** Withdraws invitations held between two people whose friend request was declined or cancelled */
export async function dropHeldInvites(a: ObjectId, b: ObjectId) {
  const { invites, hackathons, projects } = await collections();
  for (const [inviter, invitee] of directions(a, b)) {
    const held = await invites.find({ invitedBy: inviter, inviteeUserId: invitee, waitingForFriendship: true }).toArray();
    for (const invite of held) {
      await hackathons.updateOne(
        { _id: invite.hackathonId },
        { $pull: { operatives: { id: invite.operativeId, invitePending: true } }, $set: { updatedAt: new Date() }, $inc: { version: 1 } }
      );
    }
    await invites.deleteMany({ _id: { $in: held.map((i) => i._id) } });
    await projects.updateMany(
      { 'pendingInvites.userId': invitee },
      { $pull: { pendingInvites: { userId: invitee, invitedBy: inviter, waitingForFriendship: true } } }
    );
  }
}

/** What an inviter is holding for someone, e.g. ["team Greenbyte", "project CarbonLens"] */
export async function heldInviteLabels(inviter: ObjectId, invitee: ObjectId) {
  const { invites, hackathons, projects } = await collections();
  const held = await invites.find({ invitedBy: inviter, inviteeUserId: invitee, waitingForFriendship: true }).toArray();
  const teams = await hackathons
    .find({ _id: { $in: held.map((i) => i.hackathonId) } }, { projection: { teamName: 1, title: 1 } })
    .toArray();
  const heldProjects = await projects
    .find(
      { pendingInvites: { $elemMatch: { userId: invitee, invitedBy: inviter, waitingForFriendship: true } } },
      { projection: { title: 1 } }
    )
    .toArray();
  return [...teams.map((h) => `team ${h.teamName} (${h.title})`), ...heldProjects.map((p) => `project ${p.title}`)];
}
