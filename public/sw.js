// Network-first service worker — never serve stale financial data from cache
const CACHE_NAME = 'findash-shell-v1';

// Static shell assets that are safe to cache (no financial data)
const SHELL_ASSETS = [
  '/',
  '/savings',
  '/expenses',
  '/remittances',
  '/settings',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {
      // Non-fatal — app still works without pre-cache
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin, and API requests — always network for those
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Network-first: try network, fall back to cache for navigation requests only
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache navigation responses opportunistically
        if (request.mode === 'navigate' && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback: serve cached page if available
        return caches.match(request).then((cached) => cached ?? caches.match('/'));
      }),
  );
});
