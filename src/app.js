import { duration,decimalHours,localDate,totals,switchRole,needsReview } from "./domain.js";
import { IndexedRepository } from "./indexed-repository.js";
import { KEY } from "./storage.js";
import { preferences } from "./preferences.js";
import { setupUpdates } from "./updates.js";
import { $,el,button,errorAt } from "./ui.js";
import { renderTotals,renderBreakdown } from "./summary-view.js";
import { setupResponsibilities } from "./responsibility-view.js";
import { setupNotes } from "./note-view.js";
import { setupTime } from "./time-view.js";
import { setupReports } from "./report-view.js";
import { setupData } from "./data-view.js";

let state,repository,selectedDay=localDate(),lastToday=localDate(),busy=false;
const warn=message=>errorAt("preference-warning",message);
const prefs=preferences(warn);
let timeFormat=prefs.get("time-format","clock"),compact=prefs.get("compact","false")==="true";
if(!["clock","decimal"].includes(timeFormat))timeFormat="clock";
const format=ms=>timeFormat==="decimal"?decimalHours(ms):duration(ms);
const channel="BroadcastChannel" in window?new BroadcastChannel(KEY):null;
let controllers=[];
const ctx={
  getState:()=>state,getRepository:()=>repository,getDay:()=>selectedDay,format,prefs,warn,
  portablePreferences:()=>({timeFormat,compact}),
  hasDrafts:()=>controllers.some(c=>c.hasDrafts?.()),
  pause:()=>activate(null),
  showDay,change,download,
  applyPreferences(p){timeFormat=p.timeFormat;compact=p.compact;prefs.set("time-format",timeFormat);prefs.set("compact",String(compact));applyDisplay();render();}
};
const responsibilities=setupResponsibilities(ctx),notes=setupNotes(ctx),time=setupTime(ctx),reports=setupReports(ctx),data=setupData(ctx);
controllers=[responsibilities,notes,time];
function applyDisplay(){
  $("time-format").value=timeFormat;document.body.classList.toggle("compact",compact);
  $("compact").textContent=compact?"Full view":"Compact view";$("compact").setAttribute("aria-pressed",String(compact));
}
async function change(fn,message,errorId="error",options){
  if(busy)return false;
  busy=true;
  try{
    state=await repository.update(fn,options);errorAt(errorId,null);errorAt("error",null);
    $("save-status").textContent="Saved on this device";render();channel?.postMessage("changed");
    $("announcement").textContent=message;return true;
  }catch(e){
    errorAt(errorId,e);
    if(e.name!=="Error")$("save-status").textContent="Changes could not be saved";
    try{state=await repository.read();render();}catch(storageError){errorAt("error","Records could not be loaded. "+storageError.message);$("save-status").textContent="Records unavailable";}
    return false;
  }finally{busy=false;}
}
async function activate(id){
  if(!state)return;
  const name=state.responsibilities.find(r=>r.id===id)?.name;
  await change(s=>switchRole(s,id,Date.now(),crypto.randomUUID()),id?"Tracking "+name:"Tracking paused");
}
let cards=[],signature="";
function renderClocks(){
  const available=state.responsibilities.filter(r=>!r.archived&&r.classification!=="unresolved");
  const next=JSON.stringify(available);
  if(next===signature)return;
  signature=next;cards=[];$("clocks").replaceChildren();
  available.slice(0,3).forEach((r,index)=>{
    const card=button("",()=>activate(r.id));card.className="clock";card.dataset.responsibilityId=r.id;
    // Stable default IDs preserve bookmarked automation while all behavior uses responsibility IDs.
    card.id=r.id;
    const value=el("span","", "clock-time"),action=el("span","", "clock-action");
    card.append(el("span",r.name,"clock-name"),el("span",r.classification==="work"?"Work":"Non-work","clock-kind"),
      value,el("span","tracked today","clock-caption"),action);
    $("clocks").append(card);cards.push({r,card,value,action,index});
  });
  if(!available.length)$("clocks").append(el("p","No available responsibilities. Add or restore one in Responsibilities.","empty"));
  const selected=$("more-clocks").value;$("more-clocks").replaceChildren();
  for(const r of available.slice(3))$("more-clocks").append(new Option(r.name,r.id));
  if([...$("more-clocks").options].some(o=>o.value===selected))$("more-clocks").value=selected;
  $("more-clocks-label").hidden=available.length<=3;$("start-selected").hidden=available.length<=3;
}
function tick(){
  if(!state)return;
  const now=Date.now(),today=localDate(now);
  if(today!==lastToday){if(selectedDay===lastToday)showDay(today);lastToday=today;}
  const todayTotals=totals(state,today,now);
  for(const {r,card,value,action,index} of cards){
    const active=state.active?.responsibilityId===r.id;card.setAttribute("aria-pressed",String(active));
    value.textContent=format(todayTotals.byResponsibility[r.id]);
    action.textContent=(active?"● Tracking":(state.active?"Switch to ":"Start ")+r.name)+" · "+(index+1);
  }
  const activeRole=state.responsibilities.find(r=>r.id===state.active?.responsibilityId);
  $("work-status").textContent=activeRole?activeRole.name+" is on the clock":"Paused · Take your time";
  $("pause").disabled=!state.active;$("stop-at").disabled=!state.active;
  $("session-status").textContent=state.active?"Current session "+format(Math.max(0,now-state.active.start))+" · continues until you pause":"Select a responsibility to begin.";
  $("today-label").textContent="TODAY'S LIVE TIMER · "+new Date(now).toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"}).toUpperCase();
  document.title=state.active?format(todayTotals.byResponsibility[state.active.responsibilityId])+" · "+activeRole.name+" — SDM":"Paused — SDM Time Manager";
  const selectedTotals=totals(state,selectedDay,now);
  renderTotals($("day-totals"),selectedTotals,format);renderBreakdown($("day-breakdown"),state,selectedTotals,format);
  $("viewing-day").textContent=selectedDay===today?"Today · "+selectedDay:"Reviewing "+selectedDay+" · The live timer above always shows today.";
  const dismissed=prefs.get("review-dismissed");
  $("long-review").hidden=!needsReview(state.active,now)||dismissed===state.active?.id;
  if(!$("long-review").hidden)$("review-description").textContent=activeRole.name+" has been running since "+new Date(state.active.start).toLocaleString()+". Keep the time or choose when it should have stopped.";
  time.tick?.();
}
function render(){
  if(!state)return;
  renderClocks();notes.render();time.render();responsibilities.render();reports.render();tick();
}
function showDay(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(new Date(date+"T12:00:00").getTime()))return;
  selectedDay=date;$("day").value=date;
  if(compact){compact=false;prefs.set("compact","false");applyDisplay();}
  if(state){notes.dayChanged();render();}
}
function download(content,name,type){
  const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement("a");
  link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$("day").value=selectedDay;$("day").onchange=()=>showDay($("day").value);
$("today").onclick=()=>showDay(localDate());
for(const [id,delta] of [["previous-day",-1],["next-day",1]])$(id).onclick=()=>{
  const d=new Date(selectedDay+"T12:00:00");d.setDate(d.getDate()+delta);showDay(localDate(d));
};
$("time-format").onchange=()=>{timeFormat=$("time-format").value;prefs.set("time-format",timeFormat);render();};
$("compact").onclick=()=>{compact=!compact;prefs.set("compact",String(compact));applyDisplay();};
$("pause").onclick=()=>activate(null);$("start-selected").onclick=()=>activate($("more-clocks").value);
$("stop-at").onclick=time.openActive;$("review-choose").onclick=time.openActive;$("review-stop").onclick=()=>activate(null);
$("keep-tracking").onclick=()=>{if(state?.active)prefs.set("review-dismissed",state.active.id);tick();};
$("help").onclick=()=>$("help-dialog").showModal();$("close-help").onclick=()=>$("help-dialog").close();
document.addEventListener("keydown",event=>{
  if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||document.querySelector("dialog[open]")||
    /INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName)||event.target.isContentEditable)return;
  const index=Number(event.key)-1;
  if(index>=0&&index<=2&&cards[index]){event.preventDefault();activate(cards[index].r.id);}
  else if(event.code==="Space"){event.preventDefault();activate(null);}
});
async function reloadState(){
  if(!repository)return;
  try{state=await repository.read();render();}
  catch(e){errorAt("error","Records could not be loaded. "+e.message+" Reopen the app after closing older windows.");$("save-status").textContent="Records unavailable";}
}
if(channel)channel.onmessage=reloadState;
document.addEventListener("visibilitychange",()=>{if(!document.hidden)reloadState();});
window.addEventListener("beforeunload",event=>{if(ctx.hasDrafts()){event.preventDefault();event.returnValue="";}});
applyDisplay();
try{
  repository=await new IndexedRepository().open();state=await repository.read();
  $("save-status").textContent="Saved on this device";render();await data.refresh();
}catch(e){errorAt("error",e.message+" Existing records have not been replaced. Close older app windows and reopen this app.");$("save-status").textContent="Records unavailable";}
setInterval(tick,1000);
setupUpdates({hasDrafts:ctx.hasDrafts,warn});

