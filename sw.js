const CACHE = "sdm-shell-v4";
const FILES = [
  "./",
  "./index.html",
  "./src/app.js",
  "./src/domain.js",
  "./src/storage.js",
  "./src/indexed-repository.js",
  "./src/reports.js",
  "./src/report-view.js",
  "./src/backup.js",
  "./src/data-view.js",
  "./src/styles.css",
  "./icon.svg",
  "./manifest.webmanifest",
];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("sdm-shell-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      ),
  ),
);
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    caches
      .match(event.request)
      .then((cached) => cached || fetch(event.request)),
  );
});
