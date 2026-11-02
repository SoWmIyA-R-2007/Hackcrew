/*
 * Installable app support: the service worker (production only), the browser's install prompt, and the
 * "new version ready" notice. Components listen for the window events announced here.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: InstallPromptEvent | null = null;
let waitingWorker: ServiceWorker | null = null;

/** Running inside the Android app (Capacitor), which injects its bridge into the page */
export const isNativeApp = () =>
  (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;

/** Running as an installed app (opened from the home screen or the Android app), not in a browser tab */
export const isInstalled = () =>
  isNativeApp() ||
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone and iPad Safari have no install prompt; people add the app from the Share menu instead */
export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const canPromptInstall = () => installPrompt !== null;
export const updateReady = () => waitingWorker !== null;

/** Shows the browser's own install dialog; resolves to whether the person installed the app */
export async function promptInstall() {
  if (!installPrompt) return false;
  const prompt = installPrompt;
  installPrompt = null;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  window.dispatchEvent(new Event('pwa-install-changed'));
  return outcome === 'accepted';
}

/** Lets the waiting new version take over; the page reloads once it has */
export function applyUpdate() {
  waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
}

function announceUpdate(worker: ServiceWorker) {
  waitingWorker = worker;
  window.dispatchEvent(new Event('pwa-update-ready'));
}

/** Call once at start-up, before React renders, so the install prompt is never missed */
export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep the browser's mini-infobar quiet; the app shows its own Install button instead
    e.preventDefault();
    installPrompt = e as InstallPromptEvent;
    window.dispatchEvent(new Event('pwa-install-changed'));
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    window.dispatchEvent(new Event('pwa-install-changed'));
  });

  // In development the service worker would serve stale files while editing, so it only runs in builds
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      if (registration.waiting && navigator.serviceWorker.controller) announceUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          // A new version is ready while an older one controls the page
          if (worker.state === 'installed' && navigator.serviceWorker.controller) announceUpdate(worker);
        });
      });
      // Look for a new version when the app comes back to the foreground, and every hour
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && registration.update());
      setInterval(() => registration.update(), 60 * 60 * 1000);
    } catch (err) {
      console.warn('The offline app could not be set up:', err);
    }
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
