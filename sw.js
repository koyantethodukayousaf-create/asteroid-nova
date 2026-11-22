const CACHE_NAME = 'asteroid-nova-v8';
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
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        ASSETS_TO_CACHE.map((url) =>
          fetch(url).then((response) => {
            if (response.ok) {
              return cache.put(url, response);
            }
          })
        )
      )
    )
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
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
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
        })
        .catch(() => caches.match('/asteroid-nova/index.html'));
    })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.text() : 'New update available in Asteroid Nova!';
  event.waitUntil(
    self.registration.showNotification('Asteroid Nova', {
      body: data,
      icon: '/asteroid-nova/launchericon-192x192.png'
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'reconnect-sync') {
    event.waitUntil(Promise.resolve());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-update') {
    event.waitUntil(Promise.resolve());
  }
});
