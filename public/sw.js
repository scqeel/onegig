const CACHE_NAME = 'onegig-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});


self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "OneGig";
  const options = {
    body: data.message || "New notification!",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: data.url || "/",
    vibrate: [200, 100, 200, 100, 200, 100, 200]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data || "/";

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // If so, just focus it.
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, then open the target URL in a new window/tab, ensuring it's relative or same-origin
      if (clients.openWindow) {
        let finalUrl = urlToOpen;
        try {
          const parsed = new URL(urlToOpen, self.location.origin);
          if (parsed.origin !== self.location.origin) {
            console.warn('Blocked opening cross-origin URL from notification:', urlToOpen);
            finalUrl = '/';
          } else {
            finalUrl = parsed.href;
          }
        } catch(e) {
          finalUrl = '/';
        }
        return clients.openWindow(finalUrl);
      }
    })
  );
});
