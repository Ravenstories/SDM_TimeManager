import { IndexedRepository } from "../src/indexed-repository.js";
import { emptyState, switchRole } from "../src/domain.js";

document.getElementById("run").onclick = async () => {
  const output = document.getElementById("results");
  output.textContent = "";
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    output.textContent += `PASS ${message}\n`;
  };
  const name = `sdm-test-${crypto.randomUUID()}`;
  let a, b;
  try {
    const legacy = {
      ...emptyState(),
      notes: [{ id: "n", role: "vd", at: 100, text: "Migrated note" }],
    };
    let now = new Date(2026, 8, 9, 10).getTime();
    a = await new IndexedRepository({
      name,
      legacy: { getItem: () => JSON.stringify(legacy) },
      now: () => now,
    }).open();
    assert(
      (await a.read()).notes[0].text === "Migrated note",
      "legacy data migrates without loss",
    );
    b = await new IndexedRepository({
      name,
      legacy: { getItem: () => null },
      now: () => now,
    }).open();
    await Promise.all([
      a.update((s) => switchRole(s, "vd", now, "a")),
      b.update((s) => switchRole(s, "sit", now + 1000, "b")),
    ]);
    const saved = await a.read();
    assert(
      saved.sessions.length === 1 && saved.active.role === "sit",
      "concurrent writes retain both role changes",
    );
    assert(
      (await a.details()).checkpoints.length === 1,
      "same-day writes create one daily checkpoint",
    );
    try {
      await a.update((s) => {
        s.notes = [];
        throw new Error("abort");
      });
    } catch {}
    assert(
      (await a.read()).notes.length === 1,
      "failed updates preserve existing records",
    );
    now += 86400000;
    await a.update((s) => switchRole(s, null, now, "c"));
    assert(
      (await a.details()).checkpoints.length === 2,
      "new day captures a recovery snapshot",
    );
    await a.update(() => emptyState(), { checkpoint: true });
    const history = (await a.details()).checkpoints;
    assert(
      history.at(-1).reason === "Before restore" &&
        history.at(-1).state.notes.length === 1,
      "restore atomically preserves prior data",
    );
    await a.recordExport();
    assert(
      (await a.details()).meta.lastExportAt === now,
      "backup export metadata survives writes",
    );
    for (let i = 0; i < 16; i++) {
      now += 86400000;
      await a.update((s) => s);
    }
    assert(
      (await a.details()).checkpoints.length === 14,
      "recovery history is bounded to 14 snapshots",
    );
    a.close();
    a = null;
    a = await new IndexedRepository({
      name,
      legacy: { getItem: () => JSON.stringify(legacy) },
      now: () => now,
    }).open();
    assert(
      (await a.read()).notes.length === 0,
      "reopening does not reimport stale legacy records",
    );
    output.textContent += "All 9 integration checks passed.\n";
  } catch (error) {
    output.textContent += `FAIL ${error.stack}\n`;
  } finally {
    a?.close();
    b?.close();
    indexedDB.deleteDatabase(name);
  }
};
