/*
 * Hackcrew service worker: makes the app installable and lets it open without a connection.
 *
 * - Pages (navigations): network first, so people always get the latest version; the saved copy of the app
 *   is used only when offline, and the app then shows its "Can't reach Hackcrew" screen.
 * - /api: never cached. Hackathons, tasks and profiles always come from the server, so nothing private is
 *   kept on the device and nothing goes stale.
 * - Built code in /assets (file names change with every build): cache first.
 * - Icons, the manifest and Google Fonts: served from the cache and refreshed in the background.
 *
 * A new version waits until the app asks it to take over (the "Reload" notice), so a page is never swapped
 * out from under someone mid-task.
 */
const VERSION = 'v1';
const SHELL = `hackcrew-shell-${VERSION}`;
const STATIC = `hackcrew-static-${VERSION}`;
const FONTS = `hackcrew-fonts-${VERSION}`;
const CURRENT = [SHELL, STATIC, FONTS];
const SHELL_URL = '/index.html';
const PRECACHE = [SHELL_URL, '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png'];
// Old builds' files pile up in the static cache; keep only the most recent ones
const STATIC_LIMIT = 120;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      // Also removes the caches saved before the app was renamed from HackTrack
      await Promise.all(names.filter((n) => /^hack(crew|track)-/.test(n) && !CURRENT.includes(n)).map((n) => caches.delete(n)));
      await trim(STATIC, STATIC_LIMIT);
      // Take control of open pages straight away, so the first install already works offline
      await self.clients.claim();
    })()
  );
});

// The page asks a waiting new version to take over when the person taps "Reload"
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONTS));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Account data, sign-in redirects and calendar files always go to the server
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, STATIC));
});

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    // Every page is the same app shell; keep the newest copy for offline use
    if (response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
      const cache = await caches.open(SHELL);
      await cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(SHELL_URL);
    return cached || new Response('Hackcrew is offline and has not been saved on this device yet.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fresh;
}

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
}
