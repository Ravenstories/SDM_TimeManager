import test from "node:test";
import assert from "node:assert/strict";
import { emptyState,migrateState,validateState,switchRole,saveSession,stopActive,saveNote,saveResponsibility,archiveResponsibility,moveResponsibility,totals,localDate,responsibilityImpact,needsReview } from "../src/domain.js";
import { emptyState as legacy } from "../src/legacy-domain.js";
test("migrate defaults and configured extra without changing historical instants",()=>{
  const old=legacy();old.extraClock={name:"Break",countsAsWork:false};old.sessions=[{id:"a",role:"extra",start:100,end:1234}];
  const migrated=migrateState(old);assert.equal(migrated.responsibilities[2].classification,"nonwork");
  assert.deepEqual(migrated.sessions[0],{id:"a",responsibilityId:"extra",start:100,end:1234});assert.equal(old.version,1);
});
test("orphaned additional history remains archived and unresolved",()=>{
  const old=legacy();old.notes=[{id:"n",role:"extra",at:100,text:"Old note"}];
  const migrated=migrateState(old);assert.equal(migrated.responsibilities[2].classification,"unresolved");
  assert.equal(migrated.responsibilities[2].archived,true);
  assert.throws(()=>switchRole(migrated,"extra",200,"a"),/Restore and classify/);
});
test("configured additional names that collide with defaults are disambiguated",()=>{
  const old=legacy();old.extraClock={name:"vd",countsAsWork:true};
  assert.equal(migrateState(old).responsibilities[2].name,"vd (additional)");
});
test("migration rejects corrupt and duplicate records rather than overwriting",()=>{
  assert.throws(()=>migrateState({version:1,sessions:[],notes:[null],active:null}));
  const s=emptyState();s.responsibilities.push({...s.responsibilities[0]});assert.throws(()=>validateState(s));
});
test("timer switch creates one completed interval and a unique active identity",()=>{
  let s=switchRole(emptyState(),"vd",100,"a");s=switchRole(s,"sit",200,"b");s=switchRole(s,null,300,"c");
  assert.equal(s.active,null);assert.equal(s.sessions.length,2);assert.equal(s.sessions[0].end,200);
});
test("classification changes update historical work totals, names and impact",()=>{
  let s=emptyState();s.sessions=[{id:"a",responsibilityId:"vd",start:100,end:3600100}];
  const edited={...s.responsibilities[0],name:"Focus",classification:"nonwork"};
  assert.equal(responsibilityImpact(s,edited,4000000).workDelta,-3600000);
  s=saveResponsibility(s,edited,s.responsibilities[0]);
  const total=totals(s,localDate(100),4000000);assert.equal(total.work,0);assert.equal(total.nonwork,3600000);
  assert.equal(s.sessions[0].responsibilityId,"vd");
});
test("archiving atomically stops a running responsibility while preserving history",()=>{
  let s=switchRole(emptyState(),"vd",100,"a");s=archiveResponsibility(s,s.responsibilities[0],true,200);
  assert.equal(s.active,null);assert.equal(s.sessions[0].end,200);assert.equal(s.responsibilities[0].archived,true);
});
test("responsibility names are trimmed, unique ignoring case, and bounded",()=>{
  const s=emptyState();assert.throws(()=>saveResponsibility(s,{id:"new",name:" vd ",classification:"work",archived:false}),/unique/);
  assert.throws(()=>saveResponsibility(s,{id:"new",name:"x".repeat(41),classification:"work",archived:false}));
  const result=saveResponsibility(s,{id:"new",name:" Break ",classification:"nonwork",archived:false});
  assert.equal(result.responsibilities[2].name,"Break");assert.equal(moveResponsibility(result,"new",-1).responsibilities[1].id,"new");
});
test("manual entries reject future times, overlaps and stale edits",()=>{
  let s=emptyState();const a={id:"a",responsibilityId:"vd",start:100,end:200};s=saveSession(s,a,300);
  assert.throws(()=>saveSession(s,{id:"b",responsibilityId:"sit",start:150,end:250},300),/overlaps/);
  assert.throws(()=>saveSession(s,{id:"b",responsibilityId:"sit",start:250,end:350},300),/future/);
  assert.throws(()=>saveSession(s,{...a,end:250},300,{...a,end:190}),/another window/);
});
test("no-op time edits preserve exact fractional seconds",()=>{
  const s=emptyState(),a={id:"a",responsibilityId:"vd",start:101,end:1123};
  const populated=saveSession(s,a,2000);assert.deepEqual(saveSession(populated,a,2000,a).sessions[0],a);
});
test("active stop-at is bounded and protects against another tab switching",()=>{
  const s=switchRole(emptyState(),"vd",100,"a");
  assert.throws(()=>stopActive(s,99,300,s.active));assert.throws(()=>stopActive(s,301,300,s.active));
  assert.equal(stopActive(s,200,300,s.active).sessions[0].end,200);
  assert.throws(()=>stopActive(s,200,300,{...s.active,start:99}),/another window/);
});
test("note edits detect concurrent deletion or updates",()=>{
  const s=saveNote(emptyState(),{id:"n",responsibilityId:"vd",at:100,text:"note"});
  assert.throws(()=>saveNote(s,{...s.notes[0],text:"update"},{...s.notes[0],text:"old"}),/another window/);
});
test("midnight totals split active time by calendar day",()=>{
  const now=new Date(2026,8,10,0,30).getTime(),s=switchRole(emptyState(),"vd",new Date(2026,8,9,23,30).getTime(),"a");
  assert.equal(totals(s,"2026-09-09",now).work,1800000);assert.equal(totals(s,"2026-09-10",now).work,1800000);
});
test("long timers are reviewed at twelve hours or a calendar-day boundary",()=>{
  const start=new Date(2026,8,9,9).getTime();assert.equal(needsReview({start},start+3600000),false);
  assert.equal(needsReview({start},start+12*3600000),true);
  assert.equal(needsReview({start:new Date(2026,8,9,23,59).getTime()},new Date(2026,8,10).getTime()),true);
});

