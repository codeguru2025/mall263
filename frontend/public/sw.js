/* Mall263 minimal service worker — enables PWA installability and safe updates. */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first: always try live content (correct for a dynamic marketplace app).
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' },
      });
    }),
  );
});
