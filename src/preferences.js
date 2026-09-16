import { KEY } from "./storage.js";

export function preferences(warn = () => {}) {
  let tabId = crypto.randomUUID();
  try {
    tabId = sessionStorage.getItem(KEY + ".editor-window") || tabId;
    sessionStorage.setItem(KEY + ".editor-window", tabId);
  } catch {
    /* The in-memory ID still separates drafts for this visit. */
  }
  const isDraft = (name) => ["note-draft-v2", "entry-draft-v2"].includes(name);
  const draftKey = (name) => KEY + ".draft." + tabId + "." + name;
  return {
    get(name, fallback = null) {
      try {
        if (isDraft(name)) {
          const own = localStorage.getItem(draftKey(name));
          if (own !== null) return JSON.parse(own).value ?? fallback;
          const legacy = localStorage.getItem(KEY + "." + name);
          if (legacy !== null) return legacy;
          // Recover the most recent unfinished draft when opening a fresh window.
          // Each window keeps its own copy, so another tab's save cannot erase it.
          let latest = null;
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith(KEY + ".draft.") || !key.endsWith("." + name))
              continue;
            try {
              const item = JSON.parse(localStorage.getItem(key));
              if (item.value !== null && (!latest || item.at > latest.at))
                latest = item;
            } catch {
              /* Ignore an unrelated malformed draft; records are separate. */
            }
          }
          return latest?.value ?? fallback;
        }
        return localStorage.getItem(KEY + "." + name) ?? fallback;
      } catch {
        warn(
          "Display preferences and drafts cannot be persisted in this browser. Time records use a separate database.",
        );
        return fallback;
      }
    },
    set(name, value) {
      try {
        if (isDraft(name)) {
          localStorage.setItem(
            draftKey(name),
            JSON.stringify({ at: Date.now(), value }),
          );
          localStorage.removeItem(KEY + "." + name);
        } else if (value === null) localStorage.removeItem(KEY + "." + name);
        else localStorage.setItem(KEY + "." + name, value);
        return true;
      } catch {
        warn(
          "Could not save a display preference or draft. Keep this window open until your edits are saved.",
        );
        return false;
      }
    },
  };
}
