import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyState, scheduleSwitchAtTotal, scheduleSwitch, applyScheduledSwitch,
  adjustActiveStart, saveSession, removeSession, totals, localDate, validateState,
} from "../src/domain.js";

const minute = 60000;
const now = new Date(2026, 8, 22, 12).getTime();
const fixture = () => ({
  ...emptyState(),
  extraClocks: [{ id: "extra-lunch", name: "Lunch", countsAsWork: false }],
  active: { role: "extra-lunch", start: now - 10 * minute },
  sessions: [
    { id: "earlier", role: "extra-lunch", start: now - 60 * minute, end: now - 55 * minute },
    { id: "work", role: "vd", start: now - 55 * minute, end: now - 40 * minute },
    { id: "yesterday", role: "extra-lunch", start: now - 24 * 60 * minute, end: now - 23 * 60 * minute },
  ],
});

test("total mode counts earlier sessions today and hands off exactly once after sleep/reload", () => {
  const planned = scheduleSwitchAtTotal(fixture(), "sit", 30 * minute, now);
  assert.equal(planned.scheduledSwitch.at, now + 15 * minute);
  const restored = validateState(JSON.parse(JSON.stringify(planned)));
  assert.equal(applyScheduledSwitch(restored, now + 14 * minute, "early"), restored);
  const switched = applyScheduledSwitch(restored, now + 40 * minute, "handoff");
  assert.equal(totals(switched, localDate(now), now + 40 * minute)["extra-lunch"], 30 * minute);
  assert.deepEqual(switched.active, { role: "sit", start: now + 15 * minute });
  assert.equal(switched.scheduledSwitch, null);
  assert.equal(applyScheduledSwitch(switched, now + 50 * minute, "again"), switched);
});

test("total mode rejects reached totals, invalid amounts, paused state and same target", () => {
  for (const target of [0, -minute, 15 * minute, NaN, Infinity, 1.5])
    assert.throws(() => scheduleSwitchAtTotal(fixture(), "sit", target, now), /greater/);
  assert.throws(() => scheduleSwitchAtTotal(emptyState(), "sit", 30 * minute, now), /Start/);
  assert.throws(() => scheduleSwitchAtTotal(fixture(), "extra-lunch", 30 * minute, now), /different/);
});

test("time corrections update total deadlines but preserve duration deadlines", () => {
  const planned = scheduleSwitchAtTotal(fixture(), "sit", 30 * minute, now);
  const adjusted = adjustActiveStart(planned, now - 20 * minute, now);
  assert.equal(adjusted.scheduledSwitch.at, now + 5 * minute);
  const edited = saveSession(planned, { ...planned.sessions[0], start: now - 65 * minute });
  assert.equal(edited.scheduledSwitch.at, now + 10 * minute);
  assert.equal(removeSession(planned, "earlier").scheduledSwitch.at, now + 20 * minute);
  const delayed = scheduleSwitch(fixture(), "sit", now + 30 * minute, now);
  assert.equal(adjustActiveStart(delayed, now - 20 * minute, now).scheduledSwitch.at, now + 30 * minute);
});

test("a correction past the target triggers a handoff at the corrected target time", () => {
  const planned = scheduleSwitchAtTotal(fixture(), "sit", 30 * minute, now);
  const adjusted = adjustActiveStart(planned, now - 35 * minute, now);
  const switched = applyScheduledSwitch(adjusted, now, "corrected");
  assert.equal(totals(switched, localDate(now), now)["extra-lunch"], 30 * minute);
  assert.equal(switched.active.start, now - 10 * minute);
});

test("total mode uses today's portion of overnight sessions and rejects unreachable totals", () => {
  const morning = new Date(2026, 8, 22, 0, 10).getTime();
  const state = { ...emptyState(), active: { role: "vd", start: morning - 20 * minute } };
  assert.equal(scheduleSwitchAtTotal(state, "sit", 30 * minute, morning).scheduledSwitch.at, morning + 20 * minute);
  const evening = new Date(2026, 8, 22, 23, 50).getTime();
  const late = { ...emptyState(), active: { role: "vd", start: evening } };
  assert.throws(() => scheduleSwitchAtTotal(late, "sit", 30 * minute, evening), /midnight/);
  assert.equal(scheduleSwitch(late, "sit", evening + 30 * minute, evening).scheduledSwitch.at, evening + 30 * minute);
});

test("backup validation accepts legacy plans and rejects malformed total metadata", () => {
  assert.doesNotThrow(() => validateState(scheduleSwitch(fixture(), "sit", now + minute, now)));
  const planned = scheduleSwitchAtTotal(fixture(), "sit", 30 * minute, now);
  for (const patch of [{ targetMs: 0 }, { targetMs: null }, { date: "2026-02-30" }, { date: null }, { mode: "unknown" }])
    assert.throws(() => validateState({ ...planned, scheduledSwitch: { ...planned.scheduledSwitch, ...patch } }), /valid SDM backup/);
});
