import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  getAvailableClocks,
  totals,
  switchRole,
} from "../src/domain.js";
import { migrateStoredState } from "../src/migration.js";
import { restoreBackup } from "../src/backup.js";

import { v2State } from "./fixtures/v2.js";

test("v2 conversion preserves custom clocks, exact times, notes and source metadata", () => {
  const original = v2State();
  const snapshot = structuredClone(original);
  const converted = migrateStoredState(original);
  assert.deepEqual(original, snapshot);
  assert.equal(converted.active.start, 300);
  const lunch = converted.extraClocks.find((c) => c.name === "Frokost");
  assert.equal(lunch.countsAsWork, false);
  assert.equal(converted.active.role, lunch.id);
  assert.equal(converted.notes[0].role, lunch.id);
  assert.equal(converted.notes[0].text, "Context");
  assert.equal(converted.sessions[0].end, 200);
  assert.deepEqual(converted.preferences, original.preferences);
  assert.deepEqual(
    getAvailableClocks(converted).map((c) => c.name),
    ["Frokost"],
  );
  assert.equal(totals(converted, "1970-01-01", 400)[lunch.id], 100);
  assert.equal(switchRole(converted, "sit", 400, "end").sessions.length, 2);
  assert.deepEqual(migrateStoredState(converted), converted);
});

test("existing v1 data and new multi-clock settings survive unchanged", () => {
  const original = {
    ...emptyState(),
    extraClocks: [
      { id: "extra-meetings", name: "Meeting", countsAsWork: true },
    ],
  };
  assert.deepEqual(migrateStoredState(original), original);
});

test("renamed core roles remain separate with their original labels and classification", () => {
  const original = v2State();
  original.responsibilities[0].name = "Customer";
  original.active.responsibilityId = "vd";
  const state = migrateStoredState(original);
  assert.equal(
    state.extraClocks.find((r) => r.id === state.active.role).name,
    "Customer",
  );
  assert.notEqual(state.active.role, "vd");
});

test("v2 backups and recovery points can be restored and pause at export time", () => {
  const original = v2State();
  const restored = restoreBackup(
    { state: original, exportedAt: 400 },
    500,
    "restore",
  );
  assert.equal(restored.active, null);
  assert.equal(restored.sessions.at(-1).end, 400);
});

test("malformed or unknown data are rejected before any conversion is saved", () => {
  const input = v2State();
  input.notes[0].responsibilityId = "missing";
  assert.throws(() => migrateStoredState(input));
  assert.throws(() => migrateStoredState({ version: 99 }));
});
