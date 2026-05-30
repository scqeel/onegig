const CACHE_NAME = 'onegig-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // We leave this empty to satisfy PWA installability requirements
  // without intercepting requests and causing unhandled fetch errors
  // when the network or backend is unreachable.
});
