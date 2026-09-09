import { emptyState, validateState, localDate } from "./domain.js";
import { KEY } from "./storage.js";

/** IndexedDB serializes read/write transactions across all tabs. */
export class IndexedRepository {
  constructor({
    database = indexedDB,
    legacy = localStorage,
    name = "sdm-time-manager",
    now = Date.now,
  } = {}) {
    this.database = database;
    this.legacy = legacy;
    this.name = name;
    this.now = now;
  }
  async open() {
    this.db = await new Promise((resolve, reject) => {
      const request = this.database.open(this.name, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("records");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(
          new Error("Close other app tabs to finish the storage upgrade."),
        );
    });
    this.db.onversionchange = () => this.db.close();
    await this.transaction("readwrite", (store) => {
      const request = store.get("current");
      request.onsuccess = () => {
        try {
          if (request.result !== undefined) {
            validateState(request.result);
            return;
          }
          const raw = this.legacy.getItem(KEY);
          const state =
            raw === null ? emptyState() : validateState(JSON.parse(raw));
          store.put(state, "current");
          store.put([], "checkpoints");
          store.put({ migratedAt: this.now(), lastExportAt: null }, "meta");
        } catch (error) {
          this.abort(store, error);
        }
      };
    });
    return this;
  }
  abort(store, error) {
    store.transaction.failure = error;
    store.transaction.abort();
  }
  transaction(mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        "records",
        mode,
        mode === "readwrite" ? { durability: "strict" } : {},
      );
      let result;
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () =>
        reject(
          transaction.failure ||
            transaction.error ||
            new Error("Storage transaction was cancelled."),
        );
      transaction.onerror = () => {};
      try {
        operation(transaction.objectStore("records"), (value) => {
          result = value;
        });
      } catch (error) {
        transaction.failure = error;
        transaction.abort();
      }
    });
  }
  async read() {
    return this.transaction("readonly", (store, done) => {
      const request = store.get("current");
      request.onsuccess = () => {
        try {
          done(validateState(request.result));
        } catch (error) {
          this.abort(store, error);
        }
      };
    });
  }
  async update(change, { checkpoint = false } = {}) {
    return this.transaction("readwrite", (store, done) => {
      const request = store.get("current");
      request.onsuccess = () => {
        try {
          const previous = validateState(request.result);
          const next = validateState(change(structuredClone(previous)));
          const historyRequest = store.get("checkpoints");
          historyRequest.onsuccess = () => {
            try {
              const history = historyRequest.result || [],
                now = this.now();
              if (
                checkpoint ||
                !history.length ||
                localDate(history.at(-1).at) !== localDate(now)
              ) {
                history.push({
                  id: crypto.randomUUID(),
                  at: now,
                  reason: checkpoint
                    ? "Before restore"
                    : "Daily recovery point",
                  state: previous,
                });
                store.put(history.slice(-14), "checkpoints");
              }
              store.put(next, "current");
              done(next);
            } catch (error) {
              this.abort(store, error);
            }
          };
        } catch (error) {
          this.abort(store, error);
        }
      };
    });
  }
  async details() {
    return this.transaction("readonly", (store, done) => {
      const metadata = store.get("meta"),
        checkpoints = store.get("checkpoints");
      checkpoints.onsuccess = () =>
        done({
          meta: metadata.result || {},
          checkpoints: checkpoints.result || [],
        });
    });
  }
  async recordExport() {
    return this.transaction("readwrite", (store) => {
      const request = store.get("meta");
      request.onsuccess = () =>
        store.put({ ...request.result, lastExportAt: this.now() }, "meta");
    });
  }
  close() {
    this.db.close();
  }
}
