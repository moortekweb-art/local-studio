const CACHE_NAME = 'local-studio-v12';
// Precache real routes only. /recipes is a 308 redirect stub to /configure —
// precaching a redirected response breaks offline navigation replay in
// Chromium (redirect-mode mismatch), so the destination is listed instead.
const STATIC_ASSETS = [
  '/',
  '/agent',
  '/configure',
  '/logs',
  '/manifest.json',
];

// Install event - cache static assets.
// Deliberately not cache.addAll(): that rejects the whole install if any one
// route is unavailable (a controller still booting, a route removed in a later
// build), which leaves the app with no service worker at all. Each asset is
// added independently and failures are tolerated.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        STATIC_ASSETS.map((asset) =>
          cache.add(new Request(asset, { cache: 'reload' })).catch(() => {})
        )
      )
    )
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API requests (always go to network)
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only same-origin, non-redirected 200s are worth storing. Caching a
        // redirect response and replaying it for a navigation trips Chromium's
        // redirect-mode check and surfaces as a broken page rather than a
        // cached one; opaque cross-origin responses are useless here.
        if (response.status === 200 && response.type === 'basic' && !response.redirected) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // respondWith(undefined) surfaces as a network error, so a navigation
        // to a page that was never cached would look like a broken app rather
        // than an offline one. Fall back to the cached app shell, which can
        // client-route onward, and to an explicit 503 only as a last resort.
        if (event.request.mode === 'navigate') {
          const shell = await caches.match('/');
          if (shell) return shell;
        }
        return new Response('', { status: 503, statusText: 'Offline' });
      })
  );
});
