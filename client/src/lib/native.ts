/*
 * Behaviour that only applies inside the Android app (Capacitor). This file is loaded on demand when the
 * page runs in the app, so the website never downloads it.
 */
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { api } from './api';

const RETURN_PREFIX = 'com.hacktrack.app://auth';
const VERIFIER_KEY = 'hacktrack-google-verifier';

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/**
 * Google does not allow its sign-in page inside apps, so it opens in the phone's browser. The app keeps a
 * secret and sends only its hash; the browser comes back with a one-time code that works only with the secret
 */
export async function signInWithGoogle() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  localStorage.setItem(VERIFIER_KEY, verifier);
  await Browser.open({ url: `${window.location.origin}/api/auth/google?app=${challenge}` });
}

async function finishGoogleSignIn(url: string) {
  await Browser.close().catch(() => {});
  const params = new URL(url.replace(RETURN_PREFIX, 'https://app.invalid/auth')).searchParams;
  const verifier = localStorage.getItem(VERIFIER_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  const token = params.get('token');
  if (!token || !verifier) {
    window.location.href = `/login?error=${encodeURIComponent(params.get('error') ?? 'google_failed')}`;
    return;
  }
  try {
    await api.appLogin(token, verifier);
    window.location.href = '/dashboard';
  } catch {
    window.location.href = '/login?error=google_failed';
  }
}

/** Saves a calendar file from the signed-in session and opens Android's share sheet (Calendar, Drive, …) */
async function shareCalendar(href: string) {
  try {
    const res = await fetch(href, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`Calendar export failed (${res.status})`);
    const name = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'hacktrack.ics';
    const file = await Filesystem.writeFile({
      path: name,
      data: await res.text(),
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: 'HackTrack deadlines', url: file.uri, dialogTitle: 'Add to your calendar' });
  } catch (err) {
    // Closing the share sheet without choosing also lands here; only report real failures
    if (err instanceof Error && !/cancel/i.test(err.message)) alert(`Could not export the calendar. ${err.message}`);
  }
}

/** Links to other sites open in the phone's browser; calendar files go to the share sheet */
function handleLinks() {
  document.addEventListener(
    'click',
    (e) => {
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || e.defaultPrevented) return;
      const url = new URL(link.href, window.location.href);
      if (url.protocol === 'mailto:' || url.protocol === 'tel:') return;
      if (url.origin !== window.location.origin) {
        e.preventDefault();
        Browser.open({ url: url.href });
      } else if (url.pathname.endsWith('.ics')) {
        e.preventDefault();
        shareCalendar(url.href);
      }
    },
    true
  );
}

/** Android's back button: close an open dialog first, then go back, and leave the app from the first page */
function handleBackButton() {
  App.addListener('backButton', ({ canGoBack }) => {
    if (document.querySelector('[role="dialog"]')) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      return;
    }
    if (canGoBack && window.history.length > 1) window.history.back();
    else App.minimizeApp();
  });
}

/** Status bar colours follow the app's light or dark theme */
function matchStatusBar() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    StatusBar.setStyle({ style: dark.matches ? Style.Dark : Style.Light }).catch(() => {});
    StatusBar.setBackgroundColor({ color: dark.matches ? '#11141b' : '#f5f6f3' }).catch(() => {});
  };
  apply();
  dark.addEventListener('change', apply);
}

export function initNative() {
  document.documentElement.classList.add('native-app');
  handleBackButton();
  handleLinks();
  matchStatusBar();
  App.addListener('appUrlOpen', ({ url }) => {
    if (url.startsWith(RETURN_PREFIX)) finishGoogleSignIn(url);
  });
  // The app may also have been started by the sign-in link itself
  App.getLaunchUrl()
    .then((launch) => {
      if (launch?.url.startsWith(RETURN_PREFIX)) finishGoogleSignIn(launch.url);
    })
    .catch(() => {});
  SplashScreen.hide().catch(() => {});
}
