import { HackathonView } from './types';

// Before accounts existed, hackathons were kept in the browser under this key
const LEGACY_STORAGE_KEY = 'hacktrack_hackathons_v1';

/** Hackathons saved in this browser by the old local-only version, so they can be imported */
export function getBrowserSavedHackathons(): HackathonView[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearBrowserSavedHackathons(): void {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
