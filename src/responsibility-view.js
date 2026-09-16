import { saveResponsibility, archiveResponsibility, moveResponsibility, responsibilityImpact } from "./domain.js";
import { $, el, button, errorAt } from "./ui.js";
export function setupResponsibilities(ctx) {
  let original = null;
  const values = () => ({id:original?.id || crypto.randomUUID(), name:$("responsibility-name").value,
    classification:$("responsibility-classification").value, archived:original?.archived || false});
  const dirty = () => Boolean(original || $("responsibility-name").value.trim());
  function reset() {
    original = null; $("responsibility-form").reset(); $("responsibility-form-title").textContent = "Add responsibility";
    $("save-responsibility").textContent = "Add responsibility"; $("responsibility-impact").textContent = "A new responsibility starts with no history.";
    $("reload-responsibility").hidden = true; errorAt("responsibility-error", null);
  }
  function edit(record) {
    if (dirty() && !confirm("Discard the unfinished responsibility edit?")) return;
    original = structuredClone(record); $("responsibility-name").value = record.name;
    $("responsibility-classification").value = record.classification;
    $("responsibility-form-title").textContent = "Edit responsibility"; $("save-responsibility").textContent = "Save and update history";
    $("reload-responsibility").hidden = true; errorAt("responsibility-error", null); impact();
  }
  function impact() {
    if (!original) return;
    const result = responsibilityImpact(ctx.getState(), {...original,...values()}, Date.now());
    $("responsibility-impact").textContent = result.entries + " completed entries and " + result.notes +
      " notes will use this name and classification. Work total change: " + (result.workDelta < 0 ? "−" : "+") + ctx.format(Math.abs(result.workDelta)) +
      (ctx.getState().active?.responsibilityId === original.id ? " (includes the running session)." : ".");
  }
  function render() {
    const s=ctx.getState(); if (!s) return;
    $("legacy-warning").hidden = !s.responsibilities.some(r => r.classification === "unresolved");
    $("responsibility-list").replaceChildren();
    s.responsibilities.forEach((r,index) => {
      const row=el("div",undefined,"responsibility-row"), summary=el("div");
      summary.append(el("strong",r.name),el("small",r.classification + (r.archived ? " · Archived" : "")));
      const actions=el("div",undefined,"actions");
      actions.append(button("Edit",()=>edit(r),"Edit responsibility "+r.name));
      const up=button("↑",()=>ctx.change(current=>moveResponsibility(current,r.id,-1),"Order updated","responsibility-error"),"Move "+r.name+" up");
      const down=button("↓",()=>ctx.change(current=>moveResponsibility(current,r.id,1),"Order updated","responsibility-error"),"Move "+r.name+" down");
      up.disabled=index===0; down.disabled=index===s.responsibilities.length-1;
      actions.append(up,down,button(r.archived?"Restore":"Archive",async()=>{
        if (ctx.getState().active?.responsibilityId===r.id && !confirm("Stop the running session now and archive "+r.name+"?")) return;
        await ctx.change(current=>archiveResponsibility(current,r,!r.archived,Date.now()),"Responsibility updated","responsibility-error");
      },(r.archived?"Restore ":"Archive ")+r.name));
      row.append(summary,actions); $("responsibility-list").append(row);
    });
    if (original) impact();
  }
  $("responsibility-name").oninput=impact; $("responsibility-classification").onchange=impact;
  $("responsibility-form").onsubmit=async e=>{
    e.preventDefault(); const record=values(), expected=original;
    if(await ctx.change(s=>saveResponsibility(s,record,expected),"Responsibility saved","responsibility-error")) reset();
    else $("reload-responsibility").hidden=!original;
  };
  $("reload-responsibility").onclick=()=>{
    const latest=ctx.getState().responsibilities.find(r=>r.id===original?.id);
    if(latest && confirm("Discard your edits and reload the latest responsibility?")) {original=null; $("responsibility-name").value=""; edit(latest);}
  };
  $("cancel-responsibility").onclick=()=>{if(!dirty()||confirm("Discard the unfinished responsibility edit?"))reset();};
  const close=()=>{if(!dirty()||confirm("Discard the unfinished responsibility edit?")){reset();$("responsibilities").close();}};
  $("close-responsibilities").onclick=close;
  $("responsibilities").oncancel=e=>{e.preventDefault();close();};
  $("open-responsibilities").onclick=()=>{$("responsibilities").showModal();render();};
  reset(); return {render,hasDrafts:dirty};
}

