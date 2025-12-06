const CACHE_NAME = 'studybuddy-v1';
const urlsToCache = [
  '/',
  '/login',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - DO NOT intercept API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 🚫 Skip /api requests (let them reach backend)
  if (url.pathname.startsWith('/api')) {
    return;
  }

  // ✔ Otherwise: cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request).catch(() => {
          if (event.request.destination === 'document') {
            return caches.match('/login');
          }
        });
      })
  );
});
