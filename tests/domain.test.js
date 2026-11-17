import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  switchRole,
  latestSwitch,
  adjustSwitch,
  totals,
  localDate,
  duration,
  validateState,
  dayBounds,
  saveSession,
  removeSession,
  decimalHours,
  adjustActiveStart,
  applyScheduledSwitch,
  scheduleSwitch,
  scheduleSwitchAtTotal,
} from "../src/domain.js";
test("exports the decimal-hour formatter used by the time header", () => {
  assert.equal(typeof decimalHours, "function");
});
test("switch and pause preserve mutually exclusive time", () => {
  const now = new Date(2026, 8, 9, 9).getTime();
  let s = emptyState();
  s = switchRole(s, "vd", now, "a");
  s = switchRole(s, "sit", now + 60000, "b");
  s = switchRole(s, null, now + 90000, "c");
  assert.deepEqual(totals(s, localDate(now), now + 99999), {
    vd: 60000,
    sit: 30000,
    extra: 0,
  });
  assert.equal(s.active, null);
});
test("moving the latest VD to SIT switch earlier transfers only the selected time", () => {
  const start = new Date(2026, 8, 9, 9).getTime();
  const minute = 60000;
  let state = switchRole(emptyState(), "sit", start, "start");
  state = switchRole(state, "vd", start + 10 * minute, "first-sit");
  state = switchRole(state, "sit", start + 40 * minute, "latest-vd");
  state.notes.push({
    id: "note",
    role: "vd",
    at: start + 35 * minute,
    text: "Work note",
  });
  state.sessions.reverse();
  const expected = latestSwitch(state);
  assert.deepEqual(expected, {
    sessionId: "latest-vd",
    from: "vd",
    to: "sit",
    start: start + 10 * minute,
    at: start + 40 * minute,
  });

  const adjusted = adjustSwitch(state, expected, start + 25 * minute);
  const now = start + 50 * minute;
  assert.deepEqual(totals(state, localDate(start), now), {
    vd: 30 * minute,
    sit: 20 * minute,
    extra: 0,
  });
  assert.deepEqual(totals(adjusted, localDate(start), now), {
    vd: 15 * minute,
    sit: 35 * minute,
    extra: 0,
  });
  assert.equal(adjusted.sessions[0].end, adjusted.active.start);
  assert.equal(adjusted.active.role, "sit");
  assert.deepEqual(adjusted.sessions[1], state.sessions[1]);
  assert.deepEqual(adjusted.notes, state.notes);
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(adjusted))), adjusted);
});
test("an entire SIT session can be reassigned to VD across midnight", () => {
  const start = new Date(2026, 8, 9, 23, 30).getTime();
  const switchAt = new Date(2026, 8, 10, 0, 30).getTime();
  const state = switchRole(
    switchRole(emptyState(), "sit", start, "a"),
    "vd",
    switchAt,
    "b",
  );
  const adjusted = adjustSwitch(state, latestSwitch(state), start);

  assert.deepEqual(totals(adjusted, "2026-09-09", switchAt), {
    vd: 1800000,
    sit: 0,
    extra: 0,
  });
  assert.deepEqual(totals(adjusted, "2026-09-10", switchAt), {
    vd: 1800000,
    sit: 0,
    extra: 0,
  });
  assert.equal(latestSwitch(adjusted), null);
});
test("switch adjustments reject stale snapshots and positions outside the session", () => {
  let state = switchRole(emptyState(), "vd", 100, "a");
  assert.equal(latestSwitch(state), null);
  state = switchRole(state, "sit", 300, "b");
  const expected = latestSwitch(state);
  assert.equal(adjustSwitch(state, expected, 300), state);
  for (const invalid of [99, 301, Infinity, NaN, null]) {
    assert.throws(() => adjustSwitch(state, expected, invalid), /previous session/);
  }
  const adjusted = adjustSwitch(state, expected, 200);
  assert.throws(() => adjustSwitch(adjusted, expected, 150), /latest switch changed/);
  state = switchRole(state, null, 400, "c");
  assert.equal(latestSwitch(state), null);
  state = switchRole(state, "vd", 500, "d");
  assert.equal(latestSwitch(state), null);
  assert.throws(() => adjustSwitch(state, expected, 150), /latest switch changed/);
});
test("only unambiguous VD and SIT switches without overlapping history can be adjusted", () => {
  const state = switchRole(switchRole(emptyState(), "vd", 100, "a"), "sit", 300, "b");
  for (const conflicting of [
    { id: "c", role: "extra", start: 250, end: 350 },
    { id: "c", role: "extra", start: 300, end: 300 },
    { id: "b", role: "extra", start: 10, end: 20 },
  ]) {
    assert.equal(latestSwitch({ ...state, sessions: [...state.sessions, conflicting] }), null);
  }
  const extra = { ...state, active: { ...state.active, role: "extra" } };
  assert.equal(latestSwitch(extra), null);
  assert.equal(
    latestSwitch({ ...state, sessions: [{ ...state.sessions[0], role: "extra" }] }),
    null,
  );
});
test("moving the switch preserves a delay schedule and recalculates a total schedule", () => {
  const minute = 60000;
  const start = new Date(2026, 8, 9, 9).getTime();
  const switchAt = start + 40 * minute;
  const now = start + 50 * minute;
  const state = switchRole(switchRole(emptyState(), "vd", start, "a"), "sit", switchAt, "b");
  const expected = latestSwitch(state);
  const correctedAt = start + 25 * minute;
  const delayed = scheduleSwitch(state, "vd", now + 30 * minute, now);
  assert.deepEqual(adjustSwitch(delayed, expected, correctedAt).scheduledSwitch, delayed.scheduledSwitch);

  const scheduled = scheduleSwitchAtTotal(state, "vd", 60 * minute, now);
  const adjusted = adjustSwitch(scheduled, expected, correctedAt);
  assert.deepEqual(adjusted.scheduledSwitch, {
    ...scheduled.scheduledSwitch,
    at: scheduled.scheduledSwitch.at - 15 * minute,
  });
});
test("manual sessions can be added, edited, sorted, and removed", () => {
  let state = emptyState();
  state = saveSession(
    state,
    { id: "later", role: "sit", start: 200, end: 300 },
  );
  state = saveSession(
    state,
    { id: "early", role: "vd", start: 100, end: 150 },
  );
  assert.deepEqual(state.sessions.map((item) => item.id), ["early", "later"]);
  state = saveSession(
    state,
    { id: "early", role: "sit", start: 110, end: 160 },
  );
  assert.equal(state.sessions[0].role, "sit");
  assert.deepEqual(
    removeSession(state, "later").sessions.map((item) => item.id),
    ["early"],
  );
});
test("manual sessions reject invalid and overlapping time", () => {
  const state = saveSession(
    emptyState(),
    { id: "one", role: "vd", start: 100, end: 200 },
  );
  assert.throws(
    () =>
      saveSession(
        state,
        { id: "two", role: "sit", start: 150, end: 250 },
      ),
    /overlaps/,
  );
  assert.throws(
    () =>
      saveSession(
        state,
        { id: "two", role: "sit", start: 250, end: 250 },
      ),
    /valid start/,
  );
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
test("active timer start can be adjusted without stopping it", () => {
  const now = new Date(2026, 8, 9, 9).getTime();
  const state = switchRole(emptyState(), "vd", now, "a");
  const adjusted = adjustActiveStart(state, now - 10 * 60000, now + 60000);
  assert.deepEqual(adjusted.active, {
    role: "vd",
    start: now - 10 * 60000,
  });
  assert.equal(adjusted.sessions.length, 0);
  assert.equal(totals(adjusted, localDate(now), now).vd, 10 * 60000);
});
test("active timer start cannot overlap history or be in the future", () => {
  const state = {
    ...emptyState(),
    active: { role: "sit", start: 300 },
    sessions: [{ id: "previous", role: "vd", start: 100, end: 250 }],
  };
  assert.throws(() => adjustActiveStart(state, 200, 400), /overlaps/);
  assert.throws(() => adjustActiveStart(state, 500, 400), /future/);
  assert.throws(() => adjustActiveStart(emptyState(), 100, 400), /No timer/);
});
test("scheduled switch closes the current session at the deadline", () => {
  let state = switchRole(emptyState(), "vd", 100, "start");
  state = scheduleSwitch(state, "sit", 400, 200);
  assert.equal(applyScheduledSwitch(state, 399, "switch"), state);
  state = applyScheduledSwitch(state, 800, "switch");
  assert.deepEqual(state.active, { role: "sit", start: 400 });
  assert.deepEqual(state.sessions[0], {
    role: "vd",
    start: 100,
    end: 400,
    id: "switch",
  });
  assert.equal(state.scheduledSwitch, null);
});
test("manual pause or role change cancels a scheduled switch", () => {
  let state = switchRole(emptyState(), "vd", 100, "start");
  state = scheduleSwitch(state, "sit", 400, 200);
  assert.equal(switchRole(state, "sit", 300, "manual").scheduledSwitch, null);
  let pausedState = switchRole(emptyState(), "vd", 100, "start");
  pausedState = scheduleSwitch(pausedState, "sit", 400, 200);
  assert.equal(
    switchRole(pausedState, null, 300, "pause").scheduledSwitch,
    null,
  );
});
test("scheduled switches require a future deadline and another timer", () => {
  const state = switchRole(emptyState(), "vd", 100, "start");
  assert.throws(() => scheduleSwitch(state, "vd", 400, 200), /different/);
  assert.throws(() => scheduleSwitch(state, "sit", 200, 200), /greater/);
  assert.throws(() => scheduleSwitch(emptyState(), "sit", 400, 200), /Start/);
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
test("formats decimal hours for time registration", () => {
  assert.equal(decimalHours(90 * 60000), "1.50 h");
  assert.equal(decimalHours(-1), "0.00 h");
});
test("validates configurable additional clocks", () => {
  assert.doesNotThrow(() =>
    validateState({
      ...emptyState(),
      extraClock: { name: "Break", countsAsWork: false },
    }),
  );
  assert.throws(() =>
    validateState({
      ...emptyState(),
      extraClock: { name: "", countsAsWork: false },
    }),
  );
  const manyClocks = Array.from({ length: 12 }, (_, index) => ({
    id: `extra-clock-${index + 1}`,
    name: `Task ${index + 1}`,
    countsAsWork: true,
  }));
  assert.doesNotThrow(() =>
    validateState({ ...emptyState(), extraClocks: manyClocks }),
  );
  assert.throws(() =>
    validateState({
      ...emptyState(),
      extraClocks: [manyClocks[0], manyClocks[0]],
    }),
  );
});
test("tracks any number of configured clocks independently", () => {
  const now = new Date(2026, 8, 9, 9).getTime();
  let state = {
    ...emptyState(),
    extraClocks: [
      { id: "extra-planning", name: "Planning", countsAsWork: true },
      { id: "extra-meeting", name: "Meeting", countsAsWork: true },
    ],
  };
  state = switchRole(state, "extra-planning", now, "a");
  state = switchRole(state, "extra-meeting", now + 60000, "b");
  state = switchRole(state, null, now + 180000, "c");
  const time = totals(state, localDate(now), now + 180000);
  assert.equal(time["extra-planning"], 60000);
  assert.equal(time["extra-meeting"], 120000);
});
test("local day boundaries follow calendar dates", () => {
  const [start, end] = dayBounds("2026-09-09");
  assert.equal(new Date(start).getHours(), 0);
  assert.equal(new Date(end).getDate(), 10);
});
