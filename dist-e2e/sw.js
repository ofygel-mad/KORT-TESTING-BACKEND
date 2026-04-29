const CACHE_NAME = 'kort-static-v2';
const STATIC = ['/', '/offline.html', '/manifest.json', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => {
    const fetched = fetch(request).then((networkResponse) => {
      const cloned = networkResponse.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
      return networkResponse;
    }).catch(() => cached || caches.match('/offline.html'));
    return cached || fetched;
  }));
});
