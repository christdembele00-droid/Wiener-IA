const CACHE_NAME = "wiener-ia-v6";
const BASE = new URL("./", self.location.href);
const APP_SHELL = [
  new URL("./", BASE).href,
  new URL("./index.html", BASE).href,
  new URL("./style.css", BASE).href,
  new URL("./app.js", BASE).href,
  new URL("./manifest.webmanifest", BASE).href,
  new URL("./icons/icon-192.svg", BASE).href,
  new URL("./icons/icon-512.svg", BASE).href
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match(new URL("./index.html", BASE).href)))
  );
});
