import { migrateState, stopActive, localDate, responsibility, summarize } from "./domain.js";
import { csv } from "./reports.js";
export function restoreBackup(backup,now,id){
  const state=migrateState(backup?.state);
  if(!Number.isSafeInteger(backup.exportedAt)||backup.exportedAt<0||backup.exportedAt>now+60000||
    (state.active&&backup.exportedAt<state.active.start))throw Error("Invalid backup export time.");
  return state.active?stopActive(state,backup.exportedAt,Math.max(now,backup.exportedAt),state.active):state;
}
export function backupSummary(state){
  const times=[...state.sessions.flatMap(e=>[e.start,e.end]),...state.notes.map(n=>n.at),...(state.active?[state.active.start]:[])];
  let min=Infinity,max=-Infinity;
  for(const time of times){min=Math.min(min,time);max=Math.max(max,time);}
  return {sessions:state.sessions.length,notes:state.notes.length,responsibilities:state.responsibilities.length,
    range:times.length?localDate(min)+" to "+localDate(max):"No dated records"};
}
export function sessionCsv(state,now,legacy=false){
  const entries=state.active?[...state.sessions,{...state.active,end:Math.max(now,state.active.start)}]:state.sessions;
  if(legacy)return csv([["Role","Start (UTC)","End (UTC)","Minutes"],...entries.map(e=>[
    responsibility(state,e.responsibilityId).name,new Date(e.start).toISOString(),new Date(e.end).toISOString(),((e.end-e.start)/60000).toFixed(2)])]);
  const rows=[["Type","Responsibility ID","Responsibility","Classification","Start (UTC)","End (UTC)","Milliseconds","Decimal hours"]];
  const byResponsibility=Object.fromEntries(state.responsibilities.map(r=>[r.id,0]));
  for(const e of entries){
    const r=responsibility(state,e.responsibilityId),ms=Math.max(0,e.end-e.start);byResponsibility[r.id]+=ms;
    rows.push(["Session",r.id,r.name,r.classification,new Date(e.start).toISOString(),new Date(e.end).toISOString(),ms,(ms/3600000).toFixed(4)]);
  }
  const total=summarize(state,byResponsibility);
  for(const kind of ["work","nonwork","unresolved","tracked"])rows.push(["Total","","",kind,"","",total[kind],(total[kind]/3600000).toFixed(4)]);
  return csv(rows);
}

