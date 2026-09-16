import { test, expect } from "@playwright/test";
// Real database upgrade tests exercise both successful and interrupted migrations.
async function seedV1(page, state) {
  await page.goto("/icon.svg");
  await page.evaluate(async (state) => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.open("sdm-time-manager", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("records");
      req.onsuccess = () => {
        const db = req.result,
          tx = db.transaction("records", "readwrite"),
          store = tx.objectStore("records");
        store.put(state, "current");
        store.put([], "checkpoints");
        store.put({ lastExportAt: 123 }, "meta");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onabort = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, state);
}
const legacy = () => ({
  version: 1,
  active: null,
  extraClock: null,
  sessions: [],
  notes: [],
});
test("v1 database migrates atomically with a recoverable original and blocks older writers", async ({
  page,
}) => {
  const old = legacy();
  old.sessions = [{ id: "old", role: "extra", start: 100, end: 1123 }];
  await seedV1(page, old);
  await page.goto("/");
  await expect(page.locator("#save-status")).toHaveText("Saved on this device");
  const result = await page.evaluate(async () => {
    const { IndexedRepository } = await import("/src/indexed-repository.js");
    const repo = await new IndexedRepository().open(),
      state = await repo.read(),
      details = await repo.details();
    const oldOpen = await new Promise((resolve) => {
      const req = indexedDB.open("sdm-time-manager", 1);
      req.onerror = () => resolve(req.error.name);
      req.onsuccess = () => {
        req.result.close();
        resolve("opened");
      };
    });
    repo.close();
    return { state, details, oldOpen };
  });
  expect(result.state.version).toBe(2);
  expect(result.state.sessions[0].end).toBe(1123);
  expect(result.state.responsibilities[2]).toMatchObject({
    archived: true,
    classification: "unresolved",
  });
  expect(result.details.checkpoints[0].state).toEqual(old);
  expect(result.details.meta.lastExportAt).toBe(123);
  expect(result.oldOpen).toBe("VersionError");
  await page.locator("#open-responsibilities").click();
  await expect(page.locator("#legacy-warning")).toBeVisible();
});
test("malformed v1 records are not replaced by an empty database", async ({
  page,
}) => {
  const old = { ...legacy(), notes: [null] };
  await seedV1(page, old);
  await page.goto("/");
  await expect(page.locator("#error")).toContainText(
    "Existing records have not been replaced",
  );
  const current = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("sdm-time-manager", 2);
        req.onsuccess = () => {
          const db = req.result,
            q = db.transaction("records").objectStore("records").get("current");
          q.onsuccess = () => {
            resolve(q.result);
            db.close();
          };
        };
      }),
  );
  expect(current).toEqual(old);
});
test("responsibilities can be added, renamed, reclassified and archived with their active time", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#open-responsibilities").click();
  await page.locator("#responsibility-name").fill("Break");
  await page.locator("#responsibility-classification").selectOption("nonwork");
  await page.locator("#save-responsibility").click();
  await expect(page.locator("#responsibility-list")).toContainText("Break");
  await page.locator("#close-responsibilities").click();
  await page.getByRole("button", { name: /Break Non-work/ }).click();
  await expect(page.locator("#work-status")).toHaveText(
    "Break is on the clock",
  );
  await page.locator("#open-responsibilities").click();
  await page
    .getByRole("button", { name: "Edit responsibility Break", exact: true })
    .click();
  await page.locator("#responsibility-name").fill("Meetings");
  await page.locator("#responsibility-classification").selectOption("work");
  await expect(page.locator("#responsibility-impact")).toContainText(
    "Work total change:",
  );
  await page.locator("#save-responsibility").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Archive Meetings", exact: true })
    .click();
  await page.locator("#close-responsibilities").click();
  await expect(page.locator("#work-status")).toContainText("Paused");
  await expect(page.locator("#timeline")).toContainText("Meetings");
  await expect(page.locator("#clocks")).not.toContainText("Meetings");
});
test("more than three responsibilities use the switcher and ordering updates shortcuts", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#open-responsibilities").click();
  for (const name of ["Meetings", "Admin"]) {
    await page.locator("#responsibility-name").fill(name);
    await page.locator("#save-responsibility").click();
    await expect(page.locator("#responsibility-name")).toHaveValue("");
  }
  await page.locator("#close-responsibilities").click();
  await expect(page.locator(".clock")).toHaveCount(3);
  await page.locator("#start-selected").click();
  await expect(page.locator("#work-status")).toContainText("Admin");
});

test("a blocked database upgrade asks for older windows to close", async ({
  page,
  context,
}) => {
  const holder = await context.newPage();
  await seedV1(holder, legacy());
  await holder.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open("sdm-time-manager", 1);
        request.onsuccess = () => {
          globalThis.heldDatabase = request.result;
          resolve();
        };
      }),
  );
  await page.goto("/");
  await expect(page.locator("#error")).toContainText("Close other app tabs");
  await holder.close();
  await page.reload();
  await expect(page.locator("#save-status")).toHaveText("Saved on this device");
});
test("interrupted migration rolls back the checkpoint and current record together", async ({
  page,
}) => {
  const old = legacy();
  old.sessions = [{ id: "a", role: "vd", start: 100, end: 200 }];
  await seedV1(page, old);
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === "current" && value?.version === 2)
        throw new DOMException("Migration write failed", "QuotaExceededError");
      return put.call(this, value, key);
    };
  });
  await page.goto("/");
  await expect(page.locator("#error")).toBeVisible();
  const result = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("sdm-time-manager", 2);
        req.onsuccess = () => {
          const db = req.result,
            store = db.transaction("records").objectStore("records"),
            a = store.get("current"),
            b = store.get("checkpoints");
          b.onsuccess = () => {
            resolve({ current: a.result, checkpoints: b.result });
            db.close();
          };
        };
      }),
  );
  expect(result.current).toEqual(old);
  expect(result.checkpoints).toEqual([]);
});
