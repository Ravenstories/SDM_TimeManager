import test from "node:test";
import assert from "node:assert/strict";
import { createReport,reportRange,reportCsv,legacyReportCsv,adjacentPeriod,csvCell } from "../src/reports.js";
import { emptyState } from "../src/domain.js";
test("calendar ranges cover Monday weeks, leap years and year boundaries",()=>{
  assert.deepEqual(reportRange("week","2026-01-01"),{start:"2025-12-29",end:"2026-01-05"});
  assert.deepEqual(reportRange("month","2024-02-18"),{start:"2024-02-01",end:"2024-03-01"});
  assert.deepEqual(reportRange("year","2026-12-31"),{start:"2026-01-01",end:"2027-01-01"});
  assert.throws(()=>reportRange("month","2026-02-30"));
  assert.equal(adjacentPeriod("month","2026-03-31",-1),"2026-02-28");
});
test("reports split intervals, retain notes-only days, and filter responsibilities",()=>{
  const state=emptyState();
  state.sessions=[{id:"a",responsibilityId:"vd",start:new Date(2026,7,31,23).getTime(),end:new Date(2026,8,1,1).getTime()}];
  state.notes=[{id:"n",responsibilityId:"sit",at:new Date(2026,8,2,10).getTime(),text:"Planning"}];
  const report=createReport(state,"month","2026-09-09",Date.now());
  assert.equal(report.total.work,3600000);assert.equal(report.days.length,30);assert.equal(report.days[1].notes,1);assert.equal(report.trackedDays,1);
  assert.equal(createReport(state,"month","2026-09-09",Date.now(),"vd").days[1].notes,0);
  assert.match(legacyReportCsv(report),/2026-09-01,1.0000,0.0000,0.0000,1.0000,0/);
});
test("active time is bounded by report snapshot",()=>{
  const now=new Date(2026,8,9,12).getTime(),state=emptyState();
  state.active={id:"a",responsibilityId:"sit",start:now-3600000};
  assert.equal(createReport(state,"year","2026-09-09",now).total.work,3600000);
  assert.equal(createReport(state,"month","2026-10-01",now).total.tracked,0);
});
test("work and nonwork reconcile in daily reports and exports",()=>{
  const state=emptyState();state.responsibilities[1].classification="nonwork";
  state.sessions=[{id:"a",responsibilityId:"sit",start:new Date(2026,8,9,9).getTime(),end:new Date(2026,8,9,10,30).getTime()}];
  const report=createReport(state,"day","2026-09-09",Date.now());
  assert.equal(report.total.work,0);assert.equal(report.total.nonwork,5400000);assert.equal(report.total.tracked,5400000);
  assert.match(reportCsv(report),/"sit","SIT","nonwork","1.5000"/);assert.match(reportCsv(report),/"Period total"/);
});
test("CSV quotes names and prevents spreadsheet formula execution",()=>{
  assert.equal(csvCell('Meeting, "A"'),'"Meeting, ""A"""');
  assert.equal(csvCell("=1+1"),'"\'=1+1"');
  assert.equal(csvCell("  @SUM(A1)"),'"\'  @SUM(A1)"');
});

