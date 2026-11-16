/* Sleep Tracker · service-worker.js
   Оболочка приложения кэшируется, данные (LocalStorage) service worker не трогает.
   При выпуске новой версии меняйте CACHE — старый кэш удалится автоматически. */
var CACHE = "sleeptracker-v1.1.0";
var SHELL = [
  "./",
  "index.html",
  "js/core.js",
  "js/views.js",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* stale-while-revalidate: мгновенный ответ из кэша, в фоне — обновление; офлайн работает */
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(function () { return hit || (req.mode === "navigate" ? cache.match("index.html") : undefined); });
        return hit || net;
      });
    })
  );
});
