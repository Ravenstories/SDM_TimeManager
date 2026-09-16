import { test,expect } from "@playwright/test";
async function boot(page){await page.goto("/");await expect(page.locator("#save-status")).toHaveText("Saved on this device");}
async function seed(page,fn){
  await page.evaluate(async source=>{
    const {IndexedRepository}=await import("/src/indexed-repository.js");const repo=await new IndexedRepository().open();
    await repo.update(new Function("state",source));repo.close();
  },fn);
  await page.reload();
}
test("dated notes stay on the selected day and drafts survive a timer switch and reload",async({page})=>{
  await boot(page);await page.locator("#day").fill("2026-08-12");await page.locator("#day").press("Tab");
  await expect(page.locator("#note-at")).toHaveValue("2026-08-12T12:00");
  await page.locator("#note").fill("Historical note draft");await page.locator("#vd").click();
  await expect(page.locator("#note")).toHaveValue("Historical note draft");
  page.on("dialog",dialog=>dialog.accept());await page.reload();
  await expect(page.locator("#note")).toHaveValue("Historical note draft");await expect(page.locator("#note-at")).toHaveValue("2026-08-12T12:00");
  await page.locator("#save-note").click();
  await expect(page.locator("#notes")).toContainText("Historical note draft");await expect(page.locator("#day")).toHaveValue("2026-08-12");
  await expect(page.locator("#note-count")).toHaveText("0 / 5000");
});
test("manual entry add, unchanged edit and overlap rejection preserve milliseconds",async({page})=>{
  await boot(page);await page.locator("#day").fill("2026-08-12");await page.locator("#day").press("Tab");
  await page.locator("#manage-time").click();await page.locator("#time-entry-start").fill("2026-08-12T09:00:01.123");
  await page.locator("#time-entry-end").fill("2026-08-12T10:00:02.456");await page.locator("#save-time-entry").click();
  await expect(page.locator("#time-editor")).not.toBeVisible();
  await page.getByRole("button",{name:/^Edit time /}).click();await page.locator("#save-time-entry").click();
  const interval=await page.evaluate(async()=>{
    const {IndexedRepository}=await import("/src/indexed-repository.js");const repo=await new IndexedRepository().open();const s=await repo.read();repo.close();return s.sessions[0];
  });
  expect(interval.start%1000).toBe(123);expect(interval.end%1000).toBe(456);
  await page.locator("#manage-time").click();await page.locator("#time-entry-start").fill("2026-08-12T09:30");await page.locator("#time-entry-end").fill("2026-08-12T10:30");
  await page.locator("#save-time-entry").click();await expect(page.locator("#time-entry-error")).toContainText("overlaps");
});
test("concurrent note edits preserve the local draft and offer reload",async({page,context})=>{
  await boot(page);await page.locator("#note").fill("Original");await page.locator("#save-note").click();
  await page.getByRole("button",{name:"Edit note: Original",exact:true}).click();await page.locator("#note").fill("My unsaved edit");
  const other=await context.newPage();await boot(other);
  await other.getByRole("button",{name:"Edit note: Original",exact:true}).click();await other.locator("#note").fill("Saved in second tab");await other.locator("#save-note").click();
  await expect(page.locator("#notes")).toContainText("Saved in second tab");
  await expect(page.locator("#note")).toHaveValue("My unsaved edit");
  await page.locator("#save-note").click();await expect(page.locator("#note-error")).toContainText("another window");
  page.once("dialog",dialog=>dialog.accept());await page.locator("#reload-note").click();
  await expect(page.locator("#note")).toHaveValue("Saved in second tab");
});
test("long-timer review is dismissed for that session and stop-at previews a correction",async({page})=>{
  await boot(page);await seed(page,'return {...state, active:{id:"long",responsibilityId:"vd",start:Date.now()-13*3600000}};');
  await expect(page.locator("#long-review")).toBeVisible();await page.locator("#keep-tracking").click();
  await expect(page.locator("#long-review")).not.toBeVisible();await page.reload();await expect(page.locator("#long-review")).not.toBeVisible();
  await page.locator("#stop-at").click();await expect(page.locator("#time-preview")).toContainText("Tracking stops only when you save");
  await page.locator("#save-time-entry").click();await expect(page.locator("#work-status")).toContainText("Paused");
});
test("preferences can fail while existing IndexedDB remains usable",async({page})=>{
  await boot(page);
  await page.addInitScript(()=>{
    Storage.prototype.getItem=()=>{throw new DOMException("blocked","SecurityError");};
    Storage.prototype.setItem=()=>{throw new DOMException("blocked","SecurityError");};
  });
  await page.reload();await expect(page.locator("#save-status")).toHaveText("Saved on this device");
  await expect(page.locator("#preference-warning")).toContainText("preferences");
  await page.locator("#vd").click();await expect(page.locator("#work-status")).toContainText("VD is on the clock");
});
test("time-entry drafts survive reload and compact view persists",async({page})=>{
  await boot(page);await page.locator("#compact").click();await page.reload();
  await expect(page.locator("#compact")).toHaveText("Full view");await expect(page.locator("#pause")).toBeVisible();
  await page.locator("#compact").click();await page.locator("#manage-time").click();
  await page.locator("#time-entry-start").fill("2026-08-12T09:00:01.111");
  page.on("dialog",dialog=>dialog.accept());await page.reload();
  await expect(page.locator("#time-editor")).toBeVisible();await expect(page.locator("#time-entry-start")).toHaveValue("2026-08-12T09:00:01.111");
});
test("real storage preserves 14 checkpoints and rolls back a failure after checkpoint write",async({page})=>{
  await boot(page);
  const result=await page.evaluate(async()=>{
    const {IndexedRepository}=await import("/src/indexed-repository.js");let now=1000000000;
    const repo=await new IndexedRepository({name:"checkpoint-qa",now:()=>now}).open();
    for(let i=0;i<17;i++){now+=86400000;await repo.update(s=>({...s,notes:[...s.notes,{id:"n"+i,responsibilityId:"vd",at:now,text:"note"}]}));}
    const before=await repo.read(),details=await repo.details(),put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,key){if(key==="current")throw new DOMException("simulated full disk","QuotaExceededError");return put.call(this,value,key);};
    let error;
    try{await repo.update(s=>({...s,notes:[]}),{checkpoint:true});}catch(e){error=e.name;}finally{IDBObjectStore.prototype.put=put;}
    const after=await repo.read(),afterDetails=await repo.details();repo.close();
    return {before,after,details,afterDetails,error};
  });
  expect(result.details.checkpoints).toHaveLength(14);expect(result.after).toEqual(result.before);
  expect(result.afterDetails).toEqual(result.details);expect(result.error).toBe("QuotaExceededError");
});

