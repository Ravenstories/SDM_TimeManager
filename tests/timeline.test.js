import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyState,
  scheduleSwitch,
  scheduleSwitchAtTotal,
  switchRole,
  totals,
  validateState,
} from "../src/domain.js";
import { dayTimeline, moveSwitch } from "../src/timeline.js";

const date = "2026-11-17";
const morning = new Date(`${date}T09:00:00`).getTime();
const minute = 60_000;
const time = (minutes) => morning + minutes * minute;
const session = (id, role, start, end) => ({ id, role, start: time(start), end: time(end) });

test("selecting a completed switch transfers time in either direction after later switches and a pause", () => {
  const state = {
    ...emptyState(),
    extraClocks: [{ id: "extra-review", name: "Review", countsAsWork: true, archived: true }],
    sessions: [
      session("last", "sit", 40, 55),
      session("vd", "vd", 0, 30),
      session("review", "extra-review", 30, 40),
      session("after-break", "vd", 65, 75),
    ],
    notes: [{ id: "note", role: "vd", at: time(29), text: "Keep the work note." }],
  };
  const now = time(90);
  const { switches } = dayTimeline(state, date, now);
  assert.deepEqual(switches, [
    { fromId: "vd", toId: "review", from: "vd", to: "extra-review", start: time(0), at: time(30), end: time(40) },
    { fromId: "review", toId: "last", from: "extra-review", to: "sit", start: time(30), at: time(40), end: time(55) },
  ]);

  const earlier = moveSwitch(state, switches[0], time(20), now);
  assert.deepEqual(totals(earlier, date, now), { vd: 30 * minute, sit: 15 * minute, extra: 0, "extra-review": 20 * minute });
  const later = moveSwitch(state, switches[0], time(35), now);
  assert.deepEqual(totals(later, date, now), { vd: 45 * minute, sit: 15 * minute, extra: 0, "extra-review": 5 * minute });
  assert.deepEqual(later.sessions[0], state.sessions[0]);
  assert.deepEqual(later.sessions[3], state.sessions[3]);
  assert.deepEqual(later.notes, state.notes);
  assert.equal(later.active, null);
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(later))), later);
  assert.equal(state.sessions[1].end, time(30));
  assert.throws(() => moveSwitch(later, switches[0], time(25), now), /changed/);
  assert.throws(() => moveSwitch(later, switches[1], time(41), now), /changed/);
});

test("historical edits affect an active timer's total schedule without changing its start", () => {
  const state = {
    ...emptyState(),
    sessions: [session("vd", "vd", 0, 30), session("sit", "sit", 30, 40)],
    active: { role: "vd", start: time(40) },
  };
  const now = time(50);
  const planned = scheduleSwitchAtTotal(state, "sit", 60 * minute, now);
  assert.equal(planned.scheduledSwitch.at, time(70));
  const [earlierSwitch, activeSwitch] = dayTimeline(planned, date, now).switches;
  const edited = moveSwitch(planned, earlierSwitch, time(25), now);
  assert.equal(edited.scheduledSwitch.at, time(75));
  assert.deepEqual(edited.active, state.active);

  assert.equal(activeSwitch.toId, null);
  assert.equal(activeSwitch.end, null);
  assert.throws(() => moveSwitch(planned, activeSwitch, time(51), now), /between/);
  const fromActive = moveSwitch(planned, activeSwitch, time(45), now);
  assert.equal(fromActive.active.start, time(45));
  assert.equal(fromActive.scheduledSwitch.at, time(75));
  assert.equal(dayTimeline(state, date, time(40)).switches.length, 2);
});

test("active adjustments preserve delay schedules and reject stale drafts after pausing", () => {
  const state = {
    ...emptyState(),
    sessions: [session("vd", "vd", 0, 30)],
    active: { role: "sit", start: time(30) },
  };
  const now = time(50);
  const planned = scheduleSwitch(state, "vd", time(60), now);
  const [point] = dayTimeline(planned, date, now).switches;
  assert.equal(moveSwitch(planned, point, point.at, now), planned);
  assert.deepEqual(
    moveSwitch(planned, point, time(15), now).scheduledSwitch,
    planned.scheduledSwitch,
  );
  for (const invalid of [time(-1), time(51), null, NaN, Infinity]) {
    assert.throws(() => moveSwitch(planned, point, invalid, now), /between/);
  }

  const paused = switchRole(planned, null, now, "sit");
  assert.throws(() => moveSwitch(paused, point, time(15), now), /changed/);
  const [completed] = dayTimeline(paused, date, now).switches;
  assert.equal(moveSwitch(paused, completed, time(15), now).sessions[1].start, time(15));
});

test("the timeline clips intervals at midnight but retains full adjustment bounds", () => {
  const start = new Date(`${date}T00:00:00`).getTime();
  const state = {
    ...emptyState(),
    active: { role: "sit", start },
    sessions: [{ id: "overnight", role: "vd", start: start - 30 * minute, end: start }],
  };
  const now = start + 60 * minute;
  const previousDay = dayTimeline(state, "2026-11-16", now);
  assert.equal(previousDay.segments[0].end, start);
  assert.equal(previousDay.switches.length, 0);
  const today = dayTimeline(state, date, now);
  assert.deepEqual(today.segments, [{ role: "sit", start, end: now, running: true }]);
  const [point] = today.switches;
  assert.equal(point.start, start - 30 * minute);
  const edited = moveSwitch(state, point, start - 10 * minute, now);
  assert.equal(totals(edited, "2026-11-16", now).sit, 10 * minute);
  assert.equal(dayTimeline(edited, "2026-11-16", now).switches.length, 1);
});

test("switches require distinct roles and unambiguous continuity between positive intervals", () => {
  const state = {
    ...emptyState(),
    sessions: [session("a", "vd", 0, 10), session("b", "sit", 10, 20)],
  };
  const now = time(30);
  const [point] = dayTimeline(state, date, now).switches;
  for (const sessions of [
    [state.sessions[0], session("b", "sit", 11, 20)],
    [state.sessions[0], session("b", "vd", 10, 20)],
    [...state.sessions, session("overlap", "extra", 9, 11)],
    [...state.sessions, session("a", "vd", 21, 22)],
  ]) {
    const changed = { ...state, sessions };
    assert.deepEqual(dayTimeline(changed, date, now).switches, []);
    assert.throws(() => moveSwitch(changed, point, time(5), now), /changed/);
  }
  const allToSit = moveSwitch(state, point, time(0), now);
  assert.deepEqual(dayTimeline(allToSit, date, now).segments, [{ role: "sit", start: time(0), end: time(20), running: false }]);
  assert.deepEqual(dayTimeline(allToSit, date, now).switches, []);
});
