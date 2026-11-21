const CACHE_NAME = 'asteroid-nova-v1';
const ASSETS_TO_CACHE = [
  '/asteroid-nova/',
  '/asteroid-nova/index.html',
  '/asteroid-nova/manifest.json',
  '/asteroid-nova/launchericon-48x48.png',
  '/asteroid-nova/launchericon-72x72.png',
  '/asteroid-nova/launchericon-96x96.png',
  '/asteroid-nova/launchericon-144x144.png',
  '/asteroid-nova/launchericon-192x192.png',
  '/asteroid-nova/launchericon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          networkResponse.type !== 'basic'
        ) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
