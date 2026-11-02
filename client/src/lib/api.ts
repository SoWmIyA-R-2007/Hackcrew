import {
  AppNotification,
  FriendsOverview,
  HackathonView,
  Milestone,
  MyProjectTask,
  MyTask,
  PersonSummary,
  ProjectCandidate,
  ProjectInvite,
  ProjectSummary,
  ProjectTask,
  ProjectView,
  ProfileSettings,
  PublicProfile,
  TeamInvite,
} from './types';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  hasPassword: boolean;
  hasGoogle: boolean;
  emailVerified: boolean;
  isDemo: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export class ApiError extends Error {
  // data carries extra fields from the error response, e.g. the latest hackathon on a 409 edit conflict
  constructor(
    message: string,
    public status: number,
    public data: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

/** The newer copy of a hackathon sent back when a teammate saved changes first */
export function conflictCopy(err: unknown): HackathonView | null {
  return err instanceof ApiError && err.status === 409 && err.data.hackathon ? (err.data.hackathon as HackathonView) : null;
}

/** Only same-site paths are allowed as a place to return to after signing in */
export function safeNextPath(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : null;
}

// Requests in flight, so the loading bar can show while the app waits on the server
let inFlight = 0;
const announceActivity = () => window.dispatchEvent(new CustomEvent('api-activity', { detail: inFlight }));

/** Error status 0: the request never reached the server (offline, or the server is down) */
export const NETWORK_ERROR = 0;

async function request<T>(url: string, init?: RequestInit & { background?: boolean }): Promise<T> {
  const { background, ...options } = init ?? {};
  if (!background) {
    inFlight++;
    announceActivity();
  }
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new ApiError(
      navigator.onLine === false
        ? 'You are offline. Check your internet connection and try again.'
        : 'HackTrack could not be reached. Check your connection and try again.',
      NETWORK_ERROR
    );
  } finally {
    if (!background) {
      inFlight--;
      announceActivity();
    }
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // An expired session sends the user back to sign in, then returns them to this page
    if (res.status === 401 && typeof window !== 'undefined' && !url.startsWith('/api/auth/')) {
      const here = window.location.pathname + window.location.search;
      window.location.href = `/login?expired=1&next=${encodeURIComponent(here)}`;
    }
    throw new ApiError(body.error || `Request failed (${res.status})`, res.status, body);
  }
  return body as T;
}

/** The fields the server accepts; it assigns id, code and role itself */
function toInput(h: HackathonView) {
  const { id: _id, code: _code, role: _role, ...input } = h;
  return input;
}

const hackathonUrl = (id: string, rest = '') => `/api/hackathons/${encodeURIComponent(id)}${rest}`;
const projectUrl = (id: string, rest = '') => `/api/projects/${encodeURIComponent(id)}${rest}`;

/** Project fields the server accepts when creating or editing a project */
export type ProjectDetails = Pick<
  ProjectView,
  'title' | 'tagline' | 'description' | 'status' | 'techStack' | 'links' | 'startDate' | 'targetDate'
> & { hackathonId: string | null };

export type TaskFields = Pick<
  ProjectTask,
  'title' | 'notes' | 'column' | 'priority' | 'assigneeId' | 'dueDate' | 'milestoneId' | 'pullRequest'
>;

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const projectOf = (r: { project: ProjectView }) => r.project;

export const api = {
  me: () => request<{ user: CurrentUser }>('/api/auth/me').then((r) => r.user),
  // login is an email address or a username
  login: (login: string, password: string) =>
    request<{ user: CurrentUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),
  signup: (name: string, email: string, password: string, username?: string) =>
    request<{ user: CurrentUser }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, ...(username ? { username } : {}) }),
    }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  updateProfile: (changes: { name?: string; username?: string }) =>
    request<{ user: CurrentUser }>('/api/auth/me', { method: 'PATCH', body: JSON.stringify(changes) }).then(
      (r) => r.user
    ),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ user: CurrentUser }>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }).then((r) => r.user),
  disconnectGoogle: () =>
    request<{ user: CurrentUser }>('/api/auth/google', { method: 'DELETE' }).then((r) => r.user),
  logoutAll: () => request<{ ok: true }>('/api/auth/logout-all', { method: 'POST' }),
  deleteAccount: (confirmEmail: string, password?: string) =>
    request<{ ok: true }>('/api/auth/me', { method: 'DELETE', body: JSON.stringify({ confirmEmail, password }) }),
  resendVerification: () => request<{ ok: true }>('/api/auth/resend-verification', { method: 'POST' }),
  verifyEmail: (token: string) =>
    request<{ ok: true }>('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  forgotPassword: (email: string) =>
    request<{ ok: true }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ user: CurrentUser }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }).then((r) => r.user),
  // Android app: finishes a Google sign-in from the one-time code and the secret the app kept
  appLogin: (token: string, verifier: string) =>
    request<{ user: CurrentUser }>('/api/auth/app-login', { method: 'POST', body: JSON.stringify({ token, verifier }) }).then(
      (r) => r.user
    ),
  demo: () => request<{ user: CurrentUser }>('/api/auth/demo', { method: 'POST' }).then((r) => r.user),

  listHackathons: () =>
    request<{ hackathons: HackathonView[] }>('/api/hackathons').then((r) => r.hackathons),
  getHackathon: (id: string) =>
    request<{ hackathon: HackathonView }>(`/api/hackathons/${encodeURIComponent(id)}`).then((r) => r.hackathon),
  createHackathon: (h: HackathonView) =>
    request<{ hackathon: HackathonView }>('/api/hackathons', {
      method: 'POST',
      body: JSON.stringify(toInput(h)),
    }).then((r) => r.hackathon),
  importHackathons: (list: HackathonView[]) =>
    request<{ hackathons: HackathonView[] }>('/api/hackathons/import', {
      method: 'POST',
      body: JSON.stringify({ hackathons: list.map(toInput) }),
    }).then((r) => r.hackathons),
  loadSampleHackathons: () =>
    request<{ hackathons: HackathonView[] }>('/api/hackathons/samples', { method: 'POST' }).then(
      (r) => r.hackathons
    ),
  updateHackathon: (h: HackathonView) =>
    request<{ hackathon: HackathonView }>(`/api/hackathons/${encodeURIComponent(h.id)}`, {
      method: 'PUT',
      body: JSON.stringify(toInput(h)),
    }).then((r) => r.hackathon),
  deleteHackathon: (id: string) => request<{ ok: true }>(hackathonUrl(id), { method: 'DELETE' }),
  setTaskDone: (id: string, taskId: string, completed: boolean) =>
    request<{ hackathon: HackathonView }>(hackathonUrl(id, `/tasks/${encodeURIComponent(taskId)}`), {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }).then((r) => r.hackathon),
  inviteTeammate: (id: string, email: string, role: string) =>
    request<{ hackathon: HackathonView; emailed: boolean }>(hackathonUrl(id, '/team'), {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
  removeTeammate: (id: string, operativeId: string) =>
    request<{ hackathon: HackathonView | null; left: boolean }>(
      hackathonUrl(id, `/team/${encodeURIComponent(operativeId)}`),
      { method: 'DELETE' }
    ),
  emailTeam: (id: string, note: string) =>
    request<{ sent: number }>(hackathonUrl(id, '/email-team'), { method: 'POST', body: JSON.stringify({ note }) }),
  calendarUrl: (id?: string) => (id ? hackathonUrl(id, '/calendar.ics') : '/api/hackathons/calendar.ics'),
  myTasks: () => request<{ tasks: MyTask[] }>('/api/hackathons/my-tasks').then((r) => r.tasks),

  // Polled in the background, so it never shows the loading bar
  notifications: () =>
    request<{ notifications: AppNotification[] }>('/api/notifications', { background: true }).then((r) => r.notifications),
  markNotificationsRead: () => request<{ ok: true }>('/api/notifications/read-all', { method: 'POST' }),

  myProfile: () => request<{ profile: ProfileSettings }>('/api/profile/me').then((r) => r.profile),
  updateMyProfile: (changes: {
    isPublic?: boolean;
    handle?: string;
    bio?: string;
    hiddenHackathonIds?: string[];
    shownProjectIds?: string[];
    links?: Record<string, string>;
  }) =>
    request<{ profile: ProfileSettings }>('/api/profile/me', { method: 'PATCH', body: JSON.stringify(changes) }).then(
      (r) => r.profile
    ),
  publicProfile: (handle: string) =>
    request<{ profile: PublicProfile }>(`/api/profile/${encodeURIComponent(handle)}`).then((r) => r.profile),

  friends: () => request<FriendsOverview>('/api/friends'),
  searchPeople: (q: string) =>
    request<{ people: PersonSummary[] }>(`/api/friends/search?q=${encodeURIComponent(q)}`).then((r) => r.people),
  sendFriendRequest: (username: string) =>
    request<{ status: 'pending' | 'accepted'; person: PersonSummary }>('/api/friends/requests', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
  acceptFriendRequest: (id: string) =>
    request<{ ok: true }>(`/api/friends/requests/${encodeURIComponent(id)}/accept`, { method: 'POST' }),
  deleteFriendRequest: (id: string) =>
    request<{ ok: true }>(`/api/friends/requests/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  removeFriend: (userId: string) => request<{ ok: true }>(`/api/friends/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  inviteFriend: (hackathonId: string, friendId: string, role: string) =>
    request<{ hackathon: HackathonView; emailed: boolean }>(hackathonUrl(hackathonId, '/team'), {
      method: 'POST',
      body: JSON.stringify({ friendId, role }),
    }),
  // Anyone by username: a friend gets the invite now, anyone else a friend request first
  inviteByUsername: (hackathonId: string, username: string, role: string) =>
    request<{ hackathon: HackathonView; emailed: boolean; awaitingFriend: boolean }>(hackathonUrl(hackathonId, '/team'), {
      method: 'POST',
      body: JSON.stringify({ username, role }),
    }),
  myTeamInvites: () => request<{ invites: TeamInvite[] }>('/api/invites/mine').then((r) => r.invites),
  acceptTeamInvite: (id: string) =>
    request<{ hackathonId: string; alreadyMember: boolean }>(`/api/invites/by-id/${encodeURIComponent(id)}/accept`, {
      method: 'POST',
    }),
  declineTeamInvite: (id: string) =>
    request<{ ok: true }>(`/api/invites/by-id/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listProjects: (hackathonId?: string) =>
    request<{ projects: ProjectSummary[] }>(
      `/api/projects${hackathonId ? `?hackathonId=${encodeURIComponent(hackathonId)}` : ''}`
    ).then((r) => r.projects),
  getProject: (id: string) => request<{ project: ProjectView }>(projectUrl(id)).then(projectOf),
  createProject: (details: Partial<ProjectDetails> & { title: string; addTeammates?: boolean }) =>
    request<{ project: ProjectView }>('/api/projects', send('POST', details)).then(projectOf),
  updateProject: (id: string, changes: Partial<ProjectDetails>) =>
    request<{ project: ProjectView }>(projectUrl(id), send('PATCH', changes)).then(projectOf),
  deleteProject: (id: string) => request<{ ok: true }>(projectUrl(id), send('DELETE')),
  addProjectTask: (id: string, task: Partial<TaskFields> & { title: string }) =>
    request<{ project: ProjectView }>(projectUrl(id, '/tasks'), send('POST', task)).then(projectOf),
  updateProjectTask: (id: string, taskId: string, changes: Partial<TaskFields>) =>
    request<{ project: ProjectView }>(projectUrl(id, `/tasks/${encodeURIComponent(taskId)}`), send('PATCH', changes)).then(
      projectOf
    ),
  deleteProjectTask: (id: string, taskId: string) =>
    request<{ project: ProjectView }>(projectUrl(id, `/tasks/${encodeURIComponent(taskId)}`), send('DELETE')).then(projectOf),
  addMilestone: (id: string, milestone: Pick<Milestone, 'title' | 'dueDate'>) =>
    request<{ project: ProjectView }>(projectUrl(id, '/milestones'), send('POST', milestone)).then(projectOf),
  updateMilestone: (id: string, milestoneId: string, changes: Partial<Pick<Milestone, 'title' | 'dueDate' | 'done'>>) =>
    request<{ project: ProjectView }>(
      projectUrl(id, `/milestones/${encodeURIComponent(milestoneId)}`),
      send('PATCH', changes)
    ).then(projectOf),
  deleteMilestone: (id: string, milestoneId: string) =>
    request<{ project: ProjectView }>(projectUrl(id, `/milestones/${encodeURIComponent(milestoneId)}`), send('DELETE')).then(
      projectOf
    ),
  projectCandidates: (id: string) =>
    request<{ people: ProjectCandidate[] }>(projectUrl(id, '/candidates')).then((r) => r.people),
  // A friend or teammate by account id, or anyone by username (strangers get a friend request first)
  inviteCollaborator: (id: string, who: { userId: string } | { username: string }) =>
    request<{ project: ProjectView; awaitingFriend: boolean }>(projectUrl(id, '/members'), send('POST', who)),
  withdrawProjectInvite: (id: string, userId: string) =>
    request<{ project: ProjectView }>(projectUrl(id, `/invites/${encodeURIComponent(userId)}`), send('DELETE')).then(projectOf),
  myProjectInvites: () => request<{ invites: ProjectInvite[] }>('/api/projects/invites/mine').then((r) => r.invites),
  acceptProjectInvite: (id: string) => request<{ project: ProjectView }>(projectUrl(id, '/invite/accept'), send('POST')).then(projectOf),
  declineProjectInvite: (id: string) => request<{ ok: true }>(projectUrl(id, '/invite'), send('DELETE')),
  removeCollaborator: (id: string, userId: string) =>
    request<{ project: ProjectView | null; left: boolean }>(projectUrl(id, `/members/${encodeURIComponent(userId)}`), send('DELETE')),
  syncGitHub: (id: string) =>
    request<{ project: ProjectView; finished?: number }>(projectUrl(id, '/github/sync'), {
      ...send('POST'),
      background: true,
    }),
  myProjectTasks: () => request<{ tasks: MyProjectTask[] }>('/api/projects/my-tasks').then((r) => r.tasks),

  getInvite: (token: string) =>
    request<{ hackathonTitle: string; teamName: string; inviterName: string; email: string }>(
      `/api/invites/${encodeURIComponent(token)}`
    ),
  acceptInvite: (token: string) =>
    request<{ hackathonId: string; alreadyMember: boolean }>(`/api/invites/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
    }),
};
