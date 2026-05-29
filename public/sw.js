const CACHE_NAME = 'onegig-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Simple pass-through fetch handler
  // You can add caching logic here if needed
  event.respondWith(fetch(event.request));
});
