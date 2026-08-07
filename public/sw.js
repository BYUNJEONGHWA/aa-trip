// Deliberately does no caching. Its only job is to exist with a fetch handler so
// Chrome/Android treat the site as installable — this app leans on Supabase realtime
// sync for correctness, and a caching service worker is exactly the kind of thing that
// would silently serve stale data/JS across devices (the class of bug this app has had
// the most trouble with). Every request just goes straight to the network as normal.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
