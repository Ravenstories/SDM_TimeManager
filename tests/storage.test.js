import test from "node:test";
import assert from "node:assert/strict";
import { LocalRepository } from "../src/storage.js";
import { switchRole } from "../src/domain.js";
function fixture(raw = null) {
  return {
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  };
}
function locks() {
  let tail = Promise.resolve();
  return {
    request: (_, fn) => {
      const result = tail.then(fn);
      tail = result.catch(() => {});
      return result;
    },
  };
}
test("concurrent tab writes read the latest committed state", async () => {
  const storage = fixture(),
    mutex = locks(),
    a = new LocalRepository(storage, mutex),
    b = new LocalRepository(storage, mutex);
  await Promise.all([
    a.update((s) => switchRole(s, "vd", 100, "a")),
    b.update((s) => switchRole(s, "sit", 200, "b")),
  ]);
  assert.equal(a.read().active.role, "sit");
  assert.equal(a.read().sessions.length, 1);
  assert.equal(a.read().sessions[0].end, 200);
});
test("corrupt stored data cannot be silently overwritten", async () => {
  const storage = fixture("broken"),
    repo = new LocalRepository(storage, locks());
  await assert.rejects(repo.update((s) => s));
  assert.equal(storage.getItem(), "broken");
});
test("storage failures propagate to caller", async () => {
  const storage = fixture();
  storage.setItem = () => {
    throw new Error("Quota exceeded");
  };
  const repo = new LocalRepository(storage, locks());
  await assert.rejects(
    repo.update((s) => switchRole(s, "vd", 100, "a")),
    /Quota/,
  );
  assert.equal(repo.read().active, null);
});
