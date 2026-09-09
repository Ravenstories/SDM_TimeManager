import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  switchRole,
  totals,
  localDate,
  duration,
  validateState,
  dayBounds,
} from "../src/domain.js";
test("switch and pause preserve mutually exclusive time", () => {
  const now = new Date(2026, 8, 9, 9).getTime();
  let s = emptyState();
  s = switchRole(s, "vd", now, "a");
  s = switchRole(s, "sit", now + 60000, "b");
  s = switchRole(s, null, now + 90000, "c");
  assert.deepEqual(totals(s, localDate(now), now + 99999), {
    vd: 60000,
    sit: 30000,
  });
  assert.equal(s.active, null);
});
test("sleep and reload use timestamps rather than ticks", () => {
  const now = new Date(2026, 8, 9, 9).getTime();
  const s = JSON.parse(
    JSON.stringify(switchRole(emptyState(), "vd", now, "a")),
  );
  assert.equal(totals(s, localDate(now), now + 8 * 3600000).vd, 8 * 3600000);
});
test("same role does not restart session", () => {
  const s = switchRole(emptyState(), "vd", 100, "a");
  assert.equal(switchRole(s, "vd", 200, "b"), s);
});
test("midnight splits an active session into local days", () => {
  const start = new Date(2026, 8, 9, 23, 30).getTime(),
    end = new Date(2026, 8, 10, 0, 30).getTime();
  const s = switchRole(emptyState(), "sit", start, "a");
  assert.equal(totals(s, "2026-09-09", end).sit, 1800000);
  assert.equal(totals(s, "2026-09-10", end).sit, 1800000);
});
test("clock moving backwards never creates negative time", () => {
  const s = switchRole(emptyState(), "vd", 100, "a");
  assert.equal(totals(s, localDate(100), 50).vd, 0);
  assert.equal(switchRole(s, null, 50, "b").sessions[0].end, 100);
});
test("invalid records are rejected", () => {
  assert.throws(() => validateState({ version: 2 }));
  assert.throws(() =>
    validateState({ ...emptyState(), active: { role: "bad", start: 0 } }),
  );
  assert.throws(() =>
    validateState({
      ...emptyState(),
      sessions: [{ id: "x", role: "vd", start: 10, end: 0 }],
    }),
  );
  assert.throws(() => validateState({ ...emptyState(), notes: [null] }));
});
test("formats long durations without wrapping", () =>
  assert.equal(duration(27 * 3600000 + 61000), "27:01:01"));
test("local day boundaries follow calendar dates", () => {
  const [start, end] = dayBounds("2026-09-09");
  assert.equal(new Date(start).getHours(), 0);
  assert.equal(new Date(end).getDate(), 10);
});
