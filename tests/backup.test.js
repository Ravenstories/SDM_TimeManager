import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, switchRole } from "../src/domain.js";
import { emptyState as legacy } from "../src/legacy-domain.js";
import { restoreBackup, sessionCsv } from "../src/backup.js";
test("restore closes active time at export timestamp without mutating input",()=>{
  const state=switchRole(emptyState(),"vd",100,"active");
  const result=restoreBackup({state,exportedAt:200},300);
  assert.equal(result.active,null);assert.equal(result.sessions[0].end,200);assert.equal(state.active.start,100);
});
test("invalid backup export times are rejected",()=>{
  for(const exportedAt of [-1,NaN,100000])assert.throws(()=>restoreBackup({state:emptyState(),exportedAt},300));
  assert.throws(()=>restoreBackup({state:switchRole(emptyState(),"vd",200,"a"),exportedAt:100},300));
});
test("v1 backup restores through migration and preserves precise intervals",()=>{
  const state=legacy();state.sessions=[{id:"old",role:"sit",start:100,end:1234}];
  const result=restoreBackup({state,exportedAt:2000},3000);
  assert.equal(result.version,2);assert.equal(result.sessions[0].end,1234);
  assert.equal(result.sessions[0].responsibilityId,"sit");
});
test("session CSV has exact UTC timestamps and work/nonwork summaries",()=>{
  const state=emptyState();state.sessions=[{id:"a",responsibilityId:"vd",start:100,end:1234}];
  const text=sessionCsv(state,2000);
  assert.match(text,/1970-01-01T00:00:00.100Z/);assert.match(text,/1134/);assert.match(text,/"Total","","","work"/);
});

