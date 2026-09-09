import { emptyState, validateState } from "./domain.js";
export const KEY = "sdm-time-manager.v1";
export class LocalRepository {
  constructor(storage, locks = navigator.locks) {
    this.storage = storage;
    this.locks = locks;
  }
  read() {
    const raw = this.storage.getItem(KEY);
    return raw === null ? emptyState() : validateState(JSON.parse(raw));
  }
  async update(change) {
    if (!this.locks)
      throw new Error(
        "Use a current browser over HTTPS or localhost to save safely.",
      );
    return this.locks.request(KEY, () => {
      const next = validateState(change(this.read()));
      this.storage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }
}
