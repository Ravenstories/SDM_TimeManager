import test from "node:test";
import assert from "node:assert/strict";
import { emptyState } from "../src/domain.js";
import { restoreBackup } from "../src/backup.js";
test("restore stops an imported active timer at export time, preserving the original", () => {
  const state = { ...emptyState(), active: { role: "vd", start: 100 } };
  const restored = restoreBackup({ state, exportedAt: 200 }, 300, "restored");
  assert.equal(restored.active, null);
  assert.equal(restored.sessions[0].end, 200);
  assert.equal(state.active.start, 100);
});
test("invalid backup export dates are rejected", () => {
  assert.throws(() =>
    restoreBackup({ state: emptyState(), exportedAt: -1 }, 300, "x"),
  );
  assert.throws(() =>
    restoreBackup(
      {
        state: { ...emptyState(), active: { role: "vd", start: 200 } },
        exportedAt: 100,
      },
      300,
      "x",
    ),
  );
});
