export function setupUpdates() {
  if (!("serviceWorker" in navigator)) return;
  const banner = document.getElementById("app-update");
  let controller = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const next = navigator.serviceWorker.controller;
    if (controller && next && next !== controller) banner.hidden = false;
    controller = next;
  });
  document.getElementById("reload-app").onclick = () => location.reload();

  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" })
    .then((registration) => {
      let lastCheck = 0;
      const check = () => {
        if (document.hidden || Date.now() - lastCheck < 60000) return;
        lastCheck = Date.now();
        // Being offline must not interrupt tracking or produce an app error.
        registration.update().catch(() => {});
      };
      check();
      window.addEventListener("focus", check);
      window.addEventListener("online", () => { lastCheck = 0; check(); });
      document.addEventListener("visibilitychange", check);
      setInterval(check, 5 * 60000);
    })
    .catch(() => {});
}
