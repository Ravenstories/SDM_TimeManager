const CACHE = "sdm-shell-v6";
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
  "./src/preferences.js",
  "./src/editing.js",
  "./src/updates.js",
  "./src/version.js",
  "./icon.svg",
  "./manifest.webmanifest",
];
self.addEventListener("message", event => {
  if (event.data?.type !== "APPLY_UPDATE") return;
  event.waitUntil((async () => {
    const windows = (await self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .filter(client => client.url.startsWith(self.registration.scope));
    if (windows.length > 1) {
      event.source?.postMessage({ type: "CLOSE_OTHER_WINDOWS" });
      return;
    }
    await self.skipWaiting();
  })());
});
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
        ).then(async () => {
          await self.clients.claim();
          const windows = await self.clients.matchAll({ type: "window" });
          windows.filter(client => client.url.startsWith(self.registration.scope))
            .forEach(client => client.postMessage({ type: "UPDATE_READY" }));
        }),
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
