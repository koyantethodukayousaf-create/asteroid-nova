const CACHE_NAME = 'asteroid-nova-v21';
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

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(ASSETS_TO_CACHE.map(async url => {
        const response = await fetch(url, { cache: 'no-cache' });
        if (response.ok) await cache.put(url, response);
      }))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('asteroid-nova-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestURL = new URL(event.request.url);
  const isSameOrigin = requestURL.origin === self.location.origin;
  const isHTML = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(async () => {
        return (await caches.match(event.request)) ||
          (await caches.match('/asteroid-nova/index.html')) ||
          new Response('Asteroid Nova is offline and no cached page is available.', {
            status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
      })
    );
    return;
  }

  if (!isSameOrigin) return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
