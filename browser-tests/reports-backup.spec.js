import { test, expect } from "@playwright/test";
test("report figures, format labels and downloaded CSV agree", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { IndexedRepository } = await import("/src/indexed-repository.js");
    const repo = await new IndexedRepository().open();
    await repo.update((s) => ({
      ...s,
      responsibilities: s.responsibilities.map((r) => ({
        ...r,
        classification: r.id === "sit" ? "nonwork" : "work",
      })),
      sessions: [
        {
          id: "work",
          responsibilityId: "vd",
          start: new Date(2026, 7, 12, 9).getTime(),
          end: new Date(2026, 7, 12, 10).getTime(),
        },
        {
          id: "break",
          responsibilityId: "sit",
          start: new Date(2026, 7, 12, 10).getTime(),
          end: new Date(2026, 7, 12, 11).getTime(),
        },
      ],
    }));
    repo.close();
  });
  await page.reload();
  await page.locator("#time-format").selectOption("decimal");
  await page.locator("#open-reports").click();
  await page.locator("#report-period").selectOption("day");
  await page.locator("#report-anchor").fill("2026-08-12");
  await page.locator("#report-anchor").press("Tab");
  await expect(page.locator("#report-totals")).toContainText("Work time1.00 h");
  await expect(page.locator("#report-totals")).toContainText(
    "Non-work time1.00 h",
  );
  await expect(page.locator("#report-totals")).toContainText(
    "Total tracked2.00 h",
  );
  await expect(page.locator("#report-format-hint")).toContainText(
    "Decimal hours",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#report-csv").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream) csv += chunk;
  expect(csv).toContain('"vd","VD","work","1.0000"');
  expect(csv).toContain('"sit","SIT","nonwork","1.0000"');
  await page.locator("#report-role").selectOption("vd");
  await expect(page.locator("#report-totals")).toContainText(
    "Total tracked1.00 h",
  );
});
test("backup preview restores portable preferences and checkpoints current records", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#note").fill("Current records");
  await page.locator("#save-note").click();
  await page.locator("#data").click();
  const backup = {
    exportedAt: Date.now(),
    state: {
      version: 2,
      responsibilities: [
        {
          id: "personal",
          name: "Personal work",
          classification: "work",
          archived: false,
        },
      ],
      sessions: [],
      notes: [
        {
          id: "restored",
          responsibilityId: "personal",
          at: Date.now(),
          text: "Restored records",
        },
      ],
      active: null,
      preferences: { timeFormat: "decimal", compact: true },
    },
  };
  await page.locator("#import").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.locator("#restore-description")).toContainText(
    "Personal work",
  );
  await expect(page.locator("#restore-description")).toContainText("1 notes");
  await page.locator("#confirm-restore").click();
  await expect(page.locator("#restore-preview")).not.toBeVisible();
  await page.locator("#close-settings").click();
  await expect(page.locator("#time-format")).toHaveValue("decimal");
  await expect(page.locator("#compact")).toHaveText("Full view");
  await page.locator("#compact").click();
  await expect(page.locator("#notes")).toContainText("Restored records");
  await expect(page.locator("#notes")).not.toContainText("Current records");
  const checkpoint = await page.evaluate(async () => {
    const { IndexedRepository } = await import("/src/indexed-repository.js");
    const repo = await new IndexedRepository().open();
    const d = await repo.details();
    repo.close();
    return d.checkpoints.at(-1);
  });
  expect(checkpoint.reason).toBe("Before restore");
  expect(checkpoint.state.notes[0].text).toBe("Current records");
});
test("invalid backups and unfinished drafts cannot replace recorded data", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#note").fill("Draft to keep");
  await page.locator("#data").click();
  await page.locator("#import").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"state":{}}'),
  });
  await expect(page.locator("#data-error")).toBeVisible();
  await expect(page.locator("#restore-preview")).not.toBeVisible();
  await page.locator("#close-settings").click();
  await expect(page.locator("#note")).toHaveValue("Draft to keep");
});
