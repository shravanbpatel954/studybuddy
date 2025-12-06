const CACHE_NAME = 'studybuddy-v3';

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
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch — Do NOT intercept API calls
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api')) return;

  event.respondWith(
    caches.match(event.request).then(response => {
      return response ||
        fetch(event.request).catch(() => {
          if (event.request.destination === 'document') {
            return caches.match('/login');
          }
        });
    })
  );
});
