import { KEY } from "./storage.js";

export function preferences(warn = () => {}) {
  return {
    get(name, fallback = null) {
      try { return localStorage.getItem(KEY + "." + name) ?? fallback; }
      catch { warn("Display preferences and drafts cannot be persisted in this browser. Time records use a separate database."); return fallback; }
    },
    set(name, value) {
      try {
        if (value === null) localStorage.removeItem(KEY + "." + name);
        else localStorage.setItem(KEY + "." + name, value);
        return true;
      } catch { warn("Could not save a display preference or draft. Keep this window open until your edits are saved."); return false; }
    },
  };
}
