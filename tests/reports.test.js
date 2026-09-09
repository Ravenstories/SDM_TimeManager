import test from "node:test";
import assert from "node:assert/strict";
import { createReport, reportRange, reportCsv } from "../src/reports.js";
import { emptyState } from "../src/domain.js";

test("calendar periods handle Monday weeks, leap years, and year boundaries", () => {
  assert.deepEqual(reportRange("week", "2026-01-01"), {
    start: "2025-12-29",
    end: "2026-01-05",
  });
  assert.deepEqual(reportRange("month", "2024-02-18"), {
    start: "2024-02-01",
    end: "2024-03-01",
  });
  assert.deepEqual(reportRange("year", "2026-12-31"), {
    start: "2026-01-01",
    end: "2027-01-01",
  });
  assert.throws(() => reportRange("month", "2026-02-30"));
});
test("monthly report splits sessions at month boundaries and includes notes-only days", () => {
  const state = emptyState();
  state.sessions.push({
    id: "a",
    role: "vd",
    start: new Date(2026, 7, 31, 23).getTime(),
    end: new Date(2026, 8, 1, 1).getTime(),
  });
  state.notes.push({
    id: "n",
    role: "sit",
    at: new Date(2026, 8, 2, 10).getTime(),
    text: "Planning",
  });
  const report = createReport(state, "month", "2026-09-09", Date.now());
  assert.equal(report.total.vd, 3600000);
  assert.equal(report.days.length, 30);
  assert.equal(report.days[1].notes, 1);
  assert.equal(report.trackedDays, 1);
  assert.match(reportCsv(report), /2026-09-01,1.0000,0.0000,1.0000,0/);
});
test("reports include an active session only until now", () => {
  const now = new Date(2026, 8, 9, 12).getTime();
  const state = {
    ...emptyState(),
    active: { role: "sit", start: now - 3600000 },
  };
  assert.equal(
    createReport(state, "year", "2026-09-09", now).total.sit,
    3600000,
  );
  assert.equal(createReport(state, "month", "2026-10-01", now).total.sit, 0);
});
