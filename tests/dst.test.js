import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
test("DST days and repeated-hour editing preserve calendar accounting", () => {
  const script = `
    import {dayBounds,emptyState,totals} from "./src/domain.js";
    import {localInputValue,inputTimestamp} from "./src/editing.js";
    const spring=dayBounds("2026-03-29"),fall=dayBounds("2026-10-25");
    const secondHour=Date.parse("2026-10-25T02:30:00+01:00");
    const unchanged=inputTimestamp(localInputValue(secondHour).replace(".000",""),secondHour);
    let missing=false;try{inputTimestamp("2026-03-29T02:30");}catch{missing=true;}
    const state=emptyState();state.sessions=[{id:"a",responsibilityId:"vd",start:spring[0],end:spring[1]}];
    console.log(JSON.stringify({spring:(spring[1]-spring[0])/3600000,fall:(fall[1]-fall[0])/3600000,unchanged,secondHour,missing,total:totals(state,"2026-03-29",spring[1]).work}));
  `;
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    { env: { ...process.env, TZ: "Europe/Copenhagen" }, encoding: "utf8" },
  );
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.spring, 23);
  assert.equal(result.fall, 25);
  assert.equal(result.unchanged, result.secondHour);
  assert.equal(result.missing, true);
  assert.equal(result.total, 23 * 3600000);
});
