/**
 * Utility helpers for date math, progress calculation, and formatting
 */

/** Calculate days remaining until a deadline */
export function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/** Format a time remaining string from a deadline */
export function formatTimeRemaining(deadline: string | null): string {
  if (!deadline) return 'No deadline';
  const days = daysUntil(deadline);
  if (days === null) return 'No deadline';
  if (days < 0) return 'OVERDUE';
  if (days === 0) return 'TODAY';
  if (days === 1) return '1 DAY';
  if (days <= 30) return `${days} DAYS`;
  return `${Math.floor(days / 7)} WEEKS`;
}

/** Time remaining label for a hackathon, accounting for finished statuses */
export function getHackathonTimeLabel(h: {
  status: string;
  submissionDeadline: string | null;
}): string {
  if (h.status === 'completed') return 'COMPLETED';
  if (h.status === 'submitted') return 'SUBMITTED';
  return formatTimeRemaining(h.submissionDeadline);
}

/** Convert an ISO date string to a value usable by <input type="datetime-local"> */
export function toDateTimeLocal(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/** Calculate weighted completion percentage from tasks */
export function calculateProgress(
  tasks: { status: string; weight: number }[]
): number {
  if (tasks.length === 0) return 0;
  const totalWeight = tasks.reduce((sum, t) => sum + t.weight, 0);
  if (totalWeight === 0) return 0;
  const completedWeight = tasks
    .filter((t) => t.status === 'done')
    .reduce((sum, t) => sum + t.weight, 0);
  return Math.round((completedWeight / totalWeight) * 100);
}

/** Generate a hackathon code from an id */
export function generateCode(id: string): string {
  const short = id.slice(0, 4).toUpperCase();
  return `#HCK-${short}`;
}

/** Format a date string for display */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'TBD';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Generate a unique ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Default avatar URL for users without one */
export const DEFAULT_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCBP1kmRXbz68p41fmeAr3Xm4duYseWzve-pBxhFwM_Lvg-cBlibeN9kLMug-zDGpD-cqrq_9_L__iPhMtJdSAfOy8ahxz6rw--W-1ufEsOLPx3JZ5nADHQau3X2E_-KtLsRVTNw7YkiI9LgQEkrpz0fKb8YBbgRv09PaLcW_d_5XVP-ywfmznPoGxqEosCYAK4iTaa16nufLe09_J1Oj4JnYzIjlHyYDIhNd0EJZrDrfMbyrwsLybp';

/** Default banner image */
export const DEFAULT_BANNER =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDPPGJJXsBJuPJ2LuAH9k2wG5C9E-VhExttldyjGQv88ucuC3y6VEGsGOOdTE7-pPtbVD-blGVhBCpAz9Skx4DAukDX4jWvNhAp2BTE41JRKYBtq5ypBokqkq9mJo_wS_rxJemFvl3s11zal5ZfLts-lzNgeBC6X5ZZGCeLDot8l7Tw2eR4LcXsGNj3IjLIzXE1k0NrFnIMyj_v_sQmXAmJALVlC7fiCyxyhDV6wJjCVSDfEiIE97eO';

/** Display label and colour classes for each hackathon status */
export const STATUS_META: Record<
  'not_started' | 'in_progress' | 'submitted' | 'completed',
  { label: string; badge: string; bar: string; barSoft: string }
> = {
  not_started: { label: 'Not started', badge: 'bg-sunken text-ink-2', bar: 'bg-ink-3', barSoft: 'bg-sunken' },
  in_progress: { label: 'In progress', badge: 'bg-accent-soft text-accent', bar: 'bg-accent', barSoft: 'bg-accent-soft' },
  submitted: { label: 'Submitted', badge: 'bg-warn-soft text-warn', bar: 'bg-warn', barSoft: 'bg-warn-soft' },
  completed: { label: 'Completed', badge: 'bg-ok-soft text-ok', bar: 'bg-ok', barSoft: 'bg-ok-soft' },
};

export const PRIORITY_LABEL: Record<'high' | 'medium' | 'low', string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};

/** Short date such as "Sep 9" (adds the year when it differs from the current one) */
export function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return 'No date';
  const date = new Date(dateStr);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Plain-language distance to a deadline, e.g. "in 12 days", "today", "8 days ago" */
export function describeDeadline(deadline: string | null): string {
  const days = daysUntil(deadline);
  if (days === null) return 'No deadline set';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return `Due in ${days} days`;
  if (days === -1) return 'Was due yesterday';
  return `Was due ${-days} days ago`;
}

/** Whether a hackathon still needs work and its deadline has passed */
export function isOverdue(h: { status: string; submissionDeadline: string | null }): boolean {
  if (h.status === 'submitted' || h.status === 'completed') return false;
  const days = daysUntil(h.submissionDeadline);
  return days !== null && days < 0;
}

/** Initials for an avatar fallback */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** A username suggestion from a name, matching the server's rules, e.g. "Kishore K V" -> "kishore-k-v" */
export function suggestUsername(name: string) {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/, '');
  return slug.length >= 3 ? slug : slug ? `${slug}-hack` : '';
}

/** Keeps only characters allowed in usernames as someone types */
export const cleanUsernameInput = (value: string) => value.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9-]/g, '').slice(0, 30);
