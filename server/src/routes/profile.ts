import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { collections } from '../db.js';
import { currentUserId, requireUser } from '../auth-middleware.js';
import { accessFilter, toHackathonView, type HackathonDoc, type UserDoc } from '../models.js';
import { projectProgress } from './projects.js';
import { usernameSchema } from '../usernames.js';
import { normalizeLink, PLATFORMS } from '../social-links.js';
import type { ProfileHackathon, ProfileProject, ProfileSettings, PublicProfile } from '../../../client/src/lib/types.js';

export const profileRouter = Router();

const NOT_FOUND = 'This profile is private or does not exist.';

const settingsSchema = z.object({
  isPublic: z.boolean().optional(),
  handle: usernameSchema.optional(),
  bio: z.string().trim().max(160, 'Keep the bio under 160 characters').optional(),
  hiddenHackathonIds: z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(500).optional(),
  // Projects to show on the public profile; every other project stays off it
  shownProjectIds: z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(500).optional(),
  // Platform id -> full link or username; an empty string removes that link
  links: z.record(z.string(), z.string().max(300)).optional(),
});

/** Only known platforms, in their fixed order */
const orderedLinks = (links: Record<string, string> | undefined) =>
  Object.fromEntries(Object.keys(PLATFORMS).flatMap((p) => (links?.[p] ? [[p, links[p]]] : [])));

/**
 * The profile view of a hackathon, from the point of view of one person on its team.
 * Only what a portfolio needs: no problem statement, tasks, links other than the project page, or teammates.
 */
function toProfileHackathon(doc: HackathonDoc, userId: ObjectId, hidden: Set<string>): ProfileHackathon {
  const h = toHackathonView(doc, userId);
  const isOwner = doc.ownerId.equals(userId);
  const me = h.operatives.find((o) => o.userId === userId.toHexString());
  return {
    id: h.id,
    title: h.title,
    teamName: h.teamName,
    domain: h.domain,
    status: h.status,
    kickoffDate: h.kickoffDate,
    submissionDeadline: h.submissionDeadline,
    finalPresentationDate: h.finalPresentationDate,
    role: me?.role || (isOwner ? 'Team lead' : 'Member'),
    position: isOwner ? 'Team lead' : 'Member',
    result: { outcome: h.result.outcome, placement: h.result.placement, prize: h.result.prize },
    projectUrl: h.submission.projectUrl,
    hidden: hidden.has(h.id),
  };
}

async function profileHackathons(user: UserDoc) {
  const { hackathons } = await collections();
  const docs = await hackathons.find(accessFilter(user._id)).sort({ kickoffDate: -1 }).toArray();
  const hidden = new Set((user.hiddenHackathonIds ?? []).map((id) => id.toHexString()));
  return docs.map((d) => toProfileHackathon(d, user._id, hidden));
}

/**
 * Projects the user owns or collaborates on, as a portfolio shows them: no board, notes or collaborators.
 * The linked hackathon is named only if the user is on its team and has not hidden it from the profile.
 */
async function profileProjects(user: UserDoc, hackathonList: ProfileHackathon[]): Promise<ProfileProject[]> {
  const { projects } = await collections();
  const docs = await projects.find(accessFilter(user._id)).sort({ updatedAt: -1 }).toArray();
  const shown = new Set((user.profileProjectIds ?? []).map((id) => id.toHexString()));
  const hackathonTitles = new Map(hackathonList.filter((h) => !h.hidden).map((h) => [h.id, h.title]));
  return docs.map((d) => ({
    id: d._id.toHexString(),
    title: d.title,
    tagline: d.tagline,
    status: d.status,
    techStack: d.techStack,
    repoUrl: d.links?.repoUrl ?? '',
    demoUrl: d.links?.demoUrl ?? '',
    hackathonTitle: d.hackathonId ? (hackathonTitles.get(d.hackathonId.toHexString()) ?? null) : null,
    position: d.ownerId.equals(user._id) ? 'Owner' : 'Collaborator',
    progress: projectProgress(d.tasks),
    shown: shown.has(d._id.toHexString()),
  }));
}

function settingsFor(user: UserDoc, list: ProfileHackathon[], projectList: ProfileProject[]): ProfileSettings {
  return {
    name: user.name,
    handle: user.handle ?? '',
    bio: user.bio ?? '',
    memberSince: user.createdAt.toISOString(),
    links: orderedLinks(user.links),
    isPublic: Boolean(user.profilePublic && user.handle),
    canBePublic: !user.isDemo,
    hackathons: list,
    projects: projectList,
  };
}

// Your own profile settings and every hackathon you are on, including hidden ones
profileRouter.get('/me', requireUser('Not signed in'), async (_req, res) => {
  const { users } = await collections();
  const user = await users.findOne({ _id: currentUserId(res) });
  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  const list = await profileHackathons(user);
  res.json({ profile: settingsFor(user, list, await profileProjects(user, list)) });
});

profileRouter.patch('/me', requireUser('Not signed in'), async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { users } = await collections();
  const user = await users.findOne({ _id: currentUserId(res) });
  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  const { isPublic, handle, bio, hiddenHackathonIds, shownProjectIds } = parsed.data;

  let links: Record<string, string> | undefined;
  if (parsed.data.links) {
    links = { ...(user.links ?? {}) };
    for (const [platform, raw] of Object.entries(parsed.data.links)) {
      const result = normalizeLink(platform, raw);
      if ('error' in result) {
        res.status(400).json({ error: result.error, field: platform });
        return;
      }
      if (result.url) links[platform] = result.url;
      else delete links[platform];
    }
  }
  if (user.isDemo && (isPublic || handle)) {
    res.status(403).json({ error: 'Demo accounts cannot have a public profile. Create an account to share yours.' });
    return;
  }
  if (isPublic && !handle && !user.handle) {
    res.status(400).json({ error: 'Choose a username first.' });
    return;
  }
  if (handle && handle !== user.handle && (await users.findOne({ handle }, { projection: { _id: 1 } }))) {
    res.status(409).json({ error: `The username ${handle} is taken. Try another.` });
    return;
  }

  try {
    const updated = await users.findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          ...(isPublic !== undefined ? { profilePublic: isPublic } : {}),
          ...(handle ? { handle } : {}),
          ...(bio !== undefined ? { bio } : {}),
          ...(hiddenHackathonIds ? { hiddenHackathonIds: hiddenHackathonIds.map((id) => new ObjectId(id)) } : {}),
          ...(shownProjectIds ? { profileProjectIds: shownProjectIds.map((id) => new ObjectId(id)) } : {}),
          ...(links ? { links } : {}),
        },
      },
      { returnDocument: 'after' }
    );
    const list = await profileHackathons(updated!);
    res.json({ profile: settingsFor(updated!, list, await profileProjects(updated!, list)) });
  } catch (err) {
    // Two people claiming the same name at the same moment: the unique index decides
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ error: `The username ${handle} is taken. Try another.` });
      return;
    }
    throw err;
  }
});

// Anyone can read a public profile; private, demo and unknown profiles all look the same (404)
profileRouter.get('/:handle', async (req, res) => {
  const handle = usernameSchema.safeParse(req.params.handle);
  const { users } = await collections();
  const user = handle.success ? await users.findOne({ handle: handle.data }) : null;
  if (!user || !user.profilePublic || user.isDemo) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }
  const all = await profileHackathons(user);
  const visible = all.filter((h) => !h.hidden).map(({ hidden: _hidden, ...rest }) => rest);
  const shownProjects = (await profileProjects(user, all))
    .filter((p) => p.shown && p.status !== 'archived')
    .map(({ shown: _shown, ...rest }) => rest);
  const profile: PublicProfile = {
    name: user.name,
    handle: user.handle!,
    bio: user.bio ?? '',
    memberSince: user.createdAt.toISOString(),
    links: orderedLinks(user.links),
    hackathons: visible,
    projects: shownProjects,
  };
  res.set('Cache-Control', 'no-store').json({ profile });
});
