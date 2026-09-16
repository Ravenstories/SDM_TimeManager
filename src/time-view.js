import { saveSession, removeSession, stopActive, dayBounds, responsibility } from "./domain.js";
import { localInputValue, inputTimestamp } from "./editing.js";
import { $, el, button, roleOptions, dateTime, errorAt } from "./ui.js";
export function setupTime(ctx) {
  let original=null,mode="new", opened=false, initialized=false;
  const values=()=>({start:$("time-entry-start").value,end:$("time-entry-end").value,responsibilityId:$("time-entry-role").value});
  function persist(){
    if(!opened)return;
    ctx.prefs.set("entry-draft-v2",JSON.stringify({original,mode,...values()}));
    preview();
  }
  function preview(){
    const v=values(),start=inputTimestamp(v.start,original?.start),end=inputTimestamp(v.end,original?.end);
    $("time-preview").textContent=Number.isFinite(start)&&Number.isFinite(end)&&end>=start?
      "Duration: "+ctx.format(end-start)+(mode==="active"?" · Tracking stops only when you save.":""):"Choose a valid time interval.";
  }
  function configure(){
    $("time-entry-start").disabled=mode==="active"; $("time-entry-role").disabled=mode==="active";
    $("time-editor-title").textContent=mode==="active"?"Correct the running session":mode==="edit"?"Edit time entry":"Add time entry";
    $("save-time-entry").textContent=mode==="active"?"Stop and save":"Save entry";
    $("reload-time-entry").hidden=true;errorAt("time-entry-error",null);preview();
  }
  function open(record=null,active=false){
    if(opened && !confirm("Discard the unfinished time entry?"))return;
    original=record?structuredClone(record):null;mode=active?"active":record?"edit":"new";opened=true;
    roleOptions($("time-entry-role"),ctx.getState());
    const now=Date.now(), day=ctx.getDay();
    const end=record?.end ?? (active?now:Math.min(now,new Date(day+"T10:00:00").getTime()));
    const start=record?.start ?? Math.min(new Date(day+"T09:00:00").getTime(),end-3600000);
    $("time-entry-role").value=record?.responsibilityId||ctx.getState().active?.responsibilityId||ctx.getState().responsibilities[0]?.id||"";
    $("time-entry-start").value=localInputValue(Math.max(0,start));$("time-entry-end").value=localInputValue(Math.max(0,end));
    configure();$("time-editor").showModal();persist();
  }
  function close(force=false){
    if(!force&&opened&&!confirm("Discard this unfinished time entry?"))return;
    opened=false;original=null;ctx.prefs.set("entry-draft-v2",null);$("time-editor").close();
  }
  function render(){
    const s=ctx.getState();if(!s)return;
    if(!initialized){
      initialized=true;
      try{
        const raw=ctx.prefs.get("entry-draft-v2");
        if(raw){const d=JSON.parse(raw);original=d.original;mode=d.mode;opened=true;roleOptions($("time-entry-role"),s);
          $("time-entry-role").value=d.responsibilityId;$("time-entry-start").value=d.start;$("time-entry-end").value=d.end;
          configure();$("time-editor").showModal();}
      }catch{ctx.warn("A time-entry draft could not be restored. Your recorded time is unchanged.");}
    }
    if(opened) {roleOptions($("time-entry-role"),s);preview();}
    const [start,end]=dayBounds(ctx.getDay());
    const entries=[...s.sessions,...(s.active?[{...s.active,end:Date.now(),running:true}]:[])]
      .filter(e=>e.start<end&&e.end>=start).sort((a,b)=>a.start-b.start);
    $("timeline").replaceChildren();
    if(!entries.length)$("timeline").append(el("p","No time recorded for this day. Add an entry or start a timer.","empty"));
    for(const e of entries){
      const row=el("article",undefined,"entry"+(e.running?" active":""));
      const duration=ctx.format(Math.max(0,Math.min(e.end,end)-Math.max(e.start,start)));
      row.append(el("strong",responsibility(s,e.responsibilityId).name+(e.running?" · Running":"")),
        el("p",dateTime(e.start)+" → "+(e.running?"Now":dateTime(e.end))),el("span",duration+" on this day","hint"));
      const actions=el("div",undefined,"actions");
      if(e.running)actions.append(button("Stop now",()=>ctx.pause()),button("Stop at…",()=>open(s.active,true)));
      else actions.append(button("Edit",()=>open(e),"Edit time "+e.id),button("Delete",async()=>{
        if(confirm("Delete this time entry?"))await ctx.change(current=>removeSession(current,e),"Time entry deleted","error");
      },"Delete time "+e.id));
      row.append(actions);$("timeline").append(row);
    }
  }
  $("time-entry-form").onsubmit=async e=>{
    e.preventDefault();const expected=original,v=values(),now=Date.now();
    const entry={id:expected?.id||crypto.randomUUID(),responsibilityId:v.responsibilityId,
      start:inputTimestamp(v.start,expected?.start),end:inputTimestamp(v.end,expected?.end)};
    const ok=await ctx.change(s=>mode==="active"?stopActive(s,entry.end,now,expected):saveSession(s,entry,now,expected),
      mode==="active"?"Tracking stopped":"Time entry saved","time-entry-error");
    if(ok)close(true);else $("reload-time-entry").hidden=!original;
  };
  $("reload-time-entry").onclick=()=>{
    if(!confirm("Discard your edits and reload the latest entry?"))return;
    const latest=mode==="active"?ctx.getState().active:ctx.getState().sessions.find(e=>e.id===original?.id);
    const active=mode==="active";close(true);if(latest)open(latest,active);
  };
  for(const id of ["time-entry-start","time-entry-end","time-entry-role"])$(id).addEventListener("input",persist);
  $("manage-time").onclick=()=>open();$("close-time-editor").onclick=()=>close();$("cancel-time-entry").onclick=()=>close();
  $("time-editor").oncancel=e=>{e.preventDefault();close();};
  return {render,hasDrafts:()=>opened,openActive:()=>{if(ctx.getState().active)open(ctx.getState().active,true);}};
}

