const CACHE_VERSION = 'v2.1';
const CACHE = `edutaskify-${CACHE_VERSION}`;
const SYNC_TAG = 'edutaskify-task-sync';

const ICON_URL = '/icon.png';
const LOGO_URL = '/logo.png';

const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  ICON_URL,
  LOGO_URL,
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return c.addAll(OFFLINE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
      .filter(function(k) { return k!== CACHE; })
      .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

var MAX_OPAQUE_SIZE = 5 * 1024;

self.addEventListener('fetch', function(e) {
  if (e.request.method!== 'GET') return;

  var url = e.request.url;

  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com')
  ) return;

  e.respondWith(
    caches.open(CACHE).then(function(cache) {
      return cache.match(e.request).then(function(cached) {

        var networkFetch = fetch(e.request).then(function(res) {
          if (!res) return res;

          var ok = res.status === 200;
          var opaque = res.type === 'opaque';

          if (ok || opaque) {
            if (opaque) {
              res.clone().blob().then(function(blob) {
                if (blob.size < MAX_OPAQUE_SIZE) {
                  cache.put(e.request, res.clone());
                }
              });
            } else {
              cache.put(e.request, res.clone());
            }
          }
          return res;
        }).catch(function() {
          return cached || caches.match('/');
        });

        return cached || networkFetch;
      });
    })
  );
});

self.addEventListener('sync', function(e) {
  if (e.tag === SYNC_TAG) {
    e.waitUntil(flushQueuedTasks());
  }
});

function flushQueuedTasks() {
  return Promise.resolve();
}

self.addEventListener('push', function(e) {
  var data = e.data
? e.data.json()
    : { title: 'EduTaskify', body: "Time to study!" };

  e.waitUntil(
    self.registration.showNotification(data.title || 'EduTaskify', {
      body: data.body || '',
      icon: ICON_URL,
      badge: ICON_URL,
      tag: data.tag || 'edutaskify',
      renotify: true,
      vibrate: [100, 50, 100],
      data: { url: data.url || self.location.origin },
      actions: [
        { action: 'open', title: '📖 Open App' },
        { action: 'dismiss', title: '✖ Dismiss' }
      ]
    })
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();

  if (e.action === 'dismiss') return;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
  .then(function(windowClients) {
        var target = e.notification.data.url || self.location.origin;
        for (var i = 0; i < windowClients.length; i++) {
          var client = windowClients[i];
          if (client.url === target && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(target);
      })
  );
});

self.addEventListener('notificationclose', function(e) {
});