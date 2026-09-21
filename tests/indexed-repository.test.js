import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import { IndexedRepository } from "../src/indexed-repository.js";
import { emptyState, switchRole } from "../src/domain.js";
import { v2State } from "./fixtures/v2.js";

function open(database, name, version) {
  return new Promise((resolve, reject) => {
    const request = database.open(name, version);
    request.onupgradeneeded = () => request.result.createObjectStore("records");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function put(db, entries) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("records", "readwrite");
    for (const [key, value] of Object.entries(entries))
      tx.objectStore("records").put(value, key);
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
}
function read(db, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction("records").objectStore("records").get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
for (const version of [1, 2]) {
  test(`database v${version} opens, retains history, supports changes and reopens`, async () => {
    const database = new IDBFactory();
    const name = "test";
    const seed = await open(database, name, version);
    const original =
      version === 2
        ? v2State()
        : { ...emptyState(), active: { role: "vd", start: 300 } };
    const meta = { migratedAt: 50, lastExportAt: 100 };
    const checkpoints = [
      {
        id: "original",
        at: 300,
        reason: "Daily recovery point",
        state: original,
      },
    ];
    await put(seed, { current: original, meta, checkpoints });
    seed.close();
    const options = {
      database,
      name,
      legacy: {
        getItem: () => {
          throw new Error("Must not read stale legacy data");
        },
      },
      now: () => 500,
    };
    let repo = await new IndexedRepository(options).open();
    assert.equal(repo.db.version, 3);
    const current = await repo.read();
    assert.equal(current.active.start, original.active.start);
    assert.deepEqual((await repo.details()).meta, meta);
    assert.deepEqual((await repo.details()).checkpoints[0], checkpoints[0]);
    if (version === 2) {
      assert.deepEqual(
        await read(repo.db, "before-v2-compatibility"),
        original,
      );
      assert.equal(current.notes[0].text, original.notes[0].text);
      assert.equal((await repo.details()).checkpoints.length, 2);
    } else assert.deepEqual(current, original);
    await repo.update((s) => switchRole(s, "sit", 500, "switch"));
    const updated = await repo.read();
    assert.equal(updated.active.role, "sit");
    assert.equal(updated.sessions.at(-1).start, 300);
    repo.close();
    repo = await new IndexedRepository(options).open();
    assert.deepEqual(await repo.read(), updated);
    if (version === 2)
      assert.deepEqual(
        await read(repo.db, "before-v2-compatibility"),
        original,
      );
    repo.close();
  });
}
test("fresh database initializes normally", async () => {
  const repo = await new IndexedRepository({
    database: new IDBFactory(),
    legacy: { getItem: () => null },
  }).open();
  assert.deepEqual(await repo.read(), emptyState());
  repo.close();
});
test("invalid v2 migration fails without replacing any stored records", async () => {
  const database = new IDBFactory();
  const name = "invalid";
  const seed = await open(database, name, 2);
  const original = v2State();
  original.notes[0].responsibilityId = "missing";
  await put(seed, { current: original, checkpoints: [] });
  seed.close();
  const repo = new IndexedRepository({
    database,
    name,
    legacy: { getItem: () => null },
  });
  await assert.rejects(repo.open(), /preserved/);
  assert.deepEqual(await read(repo.db, "current"), original);
  assert.equal(await read(repo.db, "before-v2-compatibility"), undefined);
  assert.deepEqual(await read(repo.db, "checkpoints"), []);
  repo.close();
});
