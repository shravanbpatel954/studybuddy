const CACHE_NAME = 'studybuddy-v4';

const urlsToCache = [
  '/',
  '/login',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png'
];

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => key !== CACHE_NAME && caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Don't touch API requests
  if (url.pathname.startsWith('/api')) return;

  // 2. React Router navigation requests fallback to "/"
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }

  // 3. Static assets cache-first
  event.respondWith(
    caches.match(event.request).then(response => {
      return (
        response ||
        fetch(event.request).catch(() => {
          if (event.request.destination === 'document') {
            return caches.match('/login');
          }
        })
      );
    })
  );
});
