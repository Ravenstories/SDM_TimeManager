// The production build replaces this with a hash of all shipped files.
const CACHE = "sdm-shell-dev-v12";
const FILES = [
  "./",
  "./index.html",
  "./src/app.js",
  "./src/updates.js",
  "./src/domain.js",
  "./src/migration.js",
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
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Bypass HTTP caches too, so a new shell never contains stale assets.
    await cache.addAll(FILES.map((file) =>
      new Request(new URL(file, self.location.href), { cache: "reload" }),
    ));
    // Only replace the working version after the complete shell is available.
    await self.skipWaiting();
  })());
});
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
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    caches.open(CACHE)
      .then((cache) => cache.match(event.request))
      .then((cached) => cached || fetch(event.request)),
  );
});
