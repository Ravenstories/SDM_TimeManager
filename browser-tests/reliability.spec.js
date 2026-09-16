import { test, expect } from "@playwright/test";
test("built app boots, saves a note, and preserves an active timer across reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#save-status")).toHaveText("Saved on this device");
  await page.locator("#vd").click();
  await expect(page.locator("#vd")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#save-status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.locator("#vd")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#pause").click();
  await expect(page.locator("#vd")).toHaveAttribute("aria-pressed", "false");
  await page.locator("#note").fill("Browser regression note");
  await page.locator("#note-form button[type=submit]").click();
  await expect(page.locator("#note-count")).toHaveText("0 / 5000");
  await page.reload();
  await expect(page.locator("#notes")).toContainText("Browser regression note");
  expect(errors).toEqual([]);
});
test("real IndexedDB serializes tabs and rolls back failed writes", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { IndexedRepository } = await import("/src/indexed-repository.js");
    const a = await new IndexedRepository({ name: "qa-transactions" }).open();
    const b = await new IndexedRepository({ name: "qa-transactions" }).open();
    await Promise.all([
      a.update((s) => ({
        ...s,
        notes: [
          ...s.notes,
          { id: "a", responsibilityId: "vd", at: 100, text: "a" },
        ],
      })),
      b.update((s) => ({
        ...s,
        notes: [
          ...s.notes,
          { id: "b", responsibilityId: "sit", at: 200, text: "b" },
        ],
      })),
    ]);
    try {
      await a.update(() => {
        throw Error("abort");
      });
    } catch {}
    const value = await b.read();
    a.close();
    b.close();
    return value.notes.length;
  });
  expect(result).toBe(2);
});
