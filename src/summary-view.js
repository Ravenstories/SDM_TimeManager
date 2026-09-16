import { el } from "./ui.js";
export function renderTotals(container,total,format){
  container.replaceChildren();
  for(const [key,label] of [["work","Work time"],["nonwork","Non-work time"],["unresolved","Unresolved"],["tracked","Total tracked"]]){
    const card=el("div",undefined,"total");card.append(el("span",label),el("strong",format(total[key])));container.append(card);
  }
}
export function renderBreakdown(container,state,total,format){
  container.replaceChildren();
  const rows=state.responsibilities.filter(r=>(total.byResponsibility[r.id]||0)>0);
  for(const r of rows){
    const ms=total.byResponsibility[r.id],share=el("div",undefined,"share");
    if(r.classification==="work"){
      const percent=total.work?Math.round(ms/total.work*100):0;
      const meter=el("meter");meter.min=0;meter.max=100;meter.value=percent;meter.setAttribute("aria-label",r.name+" share of work");
      share.append(el("span",r.name+" · "+percent+"% of work"),meter,el("span",format(ms)));
    }else share.append(el("span",r.name+" · "+r.classification),el("span",format(ms)));
    container.append(share);
  }
}

