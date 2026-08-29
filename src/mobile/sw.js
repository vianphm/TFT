/**
 * Service worker: giu app chay duoc khi mat mang.
 * Vo shell (html/css/js) lay tu cache truoc; goi /api cua PC thi luon di mang.
 */
var CACHE = 'tft-companion-v1';
var SHELL = [
  './',
  'index.html',
  'mobile.css',
  'app.js',
  'shared/style.css',
  'shared/tables.js',
  'shared/calc.js',
  'shared/analyzer.js',
  'shared/cdragon.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { /* thieu mot file cung khong chan cai dat */ })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  // Du lieu song (API cua app PC, Community Dragon) khong cache
  if (url.pathname.indexOf('/api/') === 0 || url.hostname.indexOf('communitydragon') >= 0) return;

  event.respondWith(
    caches.match(event.request).then(function (hit) {
      if (hit) return hit;
      return fetch(event.request).then(function (res) {
        if (res.ok && url.origin === self.location.origin) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('index.html');
      });
    })
  );
});
