// sw.js: service worker for offline use.
// Network first: when you are online you always get the newest files, so each
// merged change shows up. The cache is only the fallback when the network fails.
// Every path is relative, because the site lives at
// https://<username>.github.io/<repository>/ and not at the root of a domain.

var CACHE = 'age-capstruct-v1';

var FILES = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'capstruct.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'data/cdss.csv',
  'data/assumptions.csv',
  'data/banker_schedule.csv',
  'data/example_firms.csv',
  'data/ebit_scenarios.csv'
];

self.addEventListener('install', function (event) {
  // Save a first copy so the app opens offline even before a second visit.
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(FILES); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  // Remove caches from older versions of this file.
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n !== CACHE; })
        .map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = new URL(req.url);
  // Only handle this app's own files. Anything else goes straight to the network.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    // 'no-cache' makes the browser check with the server instead of reusing
    // a copy GitHub Pages told it to keep for a few minutes.
    fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      // Offline: use the saved copy. A page visit falls back to index.html.
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined);
      });
    })
  );
});
