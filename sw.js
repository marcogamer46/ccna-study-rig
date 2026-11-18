/* Minimal service worker: cache every fetched asset for offline use. */
var CACHE = 'ccna-rig-v3';
var CORE = ['./', 'index.html', 'css/styles.css', 'manifest.webmanifest', 'icons/icon.svg',
  'js/lib/net.js', 'js/lib/ipv6.js', 'js/lib/util.js',
  'js/app.js', 'js/progress.js', 'js/learn.js', 'js/trainers.js', 'js/quiz.js',
  'js/flashcards.js', 'js/tsim.js',
  'data/content.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // cache-first for everything (app is read-only static content)
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res && res.status === 200 && e.request.method === 'GET') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      });
    })
  );
});
