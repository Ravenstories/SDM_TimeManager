import { VERSION } from "./version.js";

export async function setupUpdates({ hasDrafts, warn }) {
  const version = document.getElementById("app-version");
  version.textContent = "Version " + VERSION;
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("./sw.js");
    const button = document.getElementById("apply-update");
    let requested = false;
    const show = () => {
      button.hidden = !registration.waiting;
    };
    show();
    registration.addEventListener("updatefound", () => {
      registration.installing?.addEventListener("statechange", show);
    });
    button.onclick = () => {
      if (hasDrafts())
        return warn(
          "Save or explicitly cancel unfinished edits before updating.",
        );
      requested = true;
      registration.waiting?.postMessage({ type: "APPLY_UPDATE" });
    };
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "CLOSE_OTHER_WINDOWS")
        warn("Close other app windows, then choose Update available again.");
      if (event.data?.type === "UPDATE_READY" && requested) {
        if (hasDrafts())
          warn("Update is ready. Save your edits, then reopen this window.");
        else location.reload();
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden)
        registration
          .update()
          .then(show)
          .catch(() => {});
    });
  } catch {
    warn(
      "Offline support could not start. Your database is separate from the offline cache.",
    );
  }
}
