import { test, expect } from "@playwright/test";
import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
test("offline reopening preserves data", async ({ page, context }) => {
  await page.goto("/");
  await page.locator("#note").fill("Offline history");
  await page.locator("#save-note").click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#notes")).toContainText("Offline history");
  await expect(page.locator("#save-status")).toHaveText("Saved on this device");
  await context.setOffline(false);
});
test("subpath update respects drafts and other windows then preserves data offline", async ({
  page,
  context,
}) => {
  const name = "qa-update-" + randomUUID(),
    root = path.resolve("dist"),
    fixture = path.resolve(root, name);
  if (path.dirname(fixture) !== root)
    throw Error("Fixture must be inside dist");
  await mkdir(fixture, { recursive: true });
  try {
    for (const file of [
      "index.html",
      "icon.svg",
      "manifest.webmanifest",
      "src",
      "sw.js",
    ])
      await cp(path.join(root, file), path.join(fixture, file), {
        recursive: true,
      });
    const worker = await readFile(path.join(fixture, "sw.js"), "utf8");
    const setVersion = async (version) => {
      await writeFile(
        path.join(fixture, "src/version.js"),
        "export const VERSION = " + JSON.stringify(version) + ";",
      );
      await writeFile(
        path.join(fixture, "sw.js"),
        worker.replace(
          /const CACHE = .*?;/,
          "const CACHE = CACHE_PREFIX + " + JSON.stringify(version) + ";",
        ),
      );
    };
    await setVersion("qa-old");
    await page.goto("/" + name + "/");
    await expect(page.locator("#app-version")).toHaveText("Version qa-old");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.locator("#note").fill("Keep through upgrade");
    await page.locator("#save-note").click();
    await page.locator("#note").fill("Unfinished upgrade draft");
    await setVersion("qa-new");
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration()).update();
    });
    await expect(page.locator("#apply-update")).toBeVisible();
    await page.locator("#apply-update").click();
    await expect(page.locator("#preference-warning")).toContainText(
      "unfinished edits",
    );
    await expect(page.locator("#note")).toHaveValue("Unfinished upgrade draft");
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#cancel-note").click();
    const other = await context.newPage();
    await other.goto("/" + name + "/");
    await page.locator("#apply-update").click();
    await expect(page.locator("#preference-warning")).toContainText(
      "Close other app windows",
    );
    await other.close();
    await page.locator("#apply-update").click();
    await expect(page.locator("#app-version")).toHaveText("Version qa-new");
    await expect(page.locator("#notes")).toContainText("Keep through upgrade");
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#notes")).toContainText("Keep through upgrade");
    await context.setOffline(false);
  } finally {
    await context.setOffline(false);
    // This is a generated fixture with a verified, bounded absolute target.
    if (path.dirname(fixture) === root)
      await rm(fixture, { recursive: true, force: true });
  }
});
test("keyboard controls avoid fields and dialogs and retain focus visibility", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("1");
  await expect(page.locator("#vd")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#note").focus();
  await page.keyboard.press("2");
  await expect(page.locator("#vd")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#help").click();
  await page.keyboard.press("2");
  await expect(page.locator("#vd")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator("#help-dialog")).not.toBeVisible();
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(
    () => getComputedStyle(document.activeElement).outlineWidth,
  );
  expect(parseFloat(outline)).toBeGreaterThan(0);
});
test("narrow and enlarged layouts keep dialogs and controls within the viewport", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(await overflow()).toBe(false);
  await page.locator("#open-responsibilities").click();
  await page
    .locator("#responsibility-name")
    .fill("A responsibility with a long name");
  await page.locator("#save-responsibility").click();
  await expect(page.locator("#responsibility-list")).toContainText(
    "A responsibility with a long name",
  );
  expect(await overflow()).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("mobile-responsibilities.png"),
    fullPage: true,
  });
  await page.locator("#close-responsibilities").click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(await overflow()).toBe(false);
  await page.locator("#manage-time").click();
  await expect(page.locator("#save-time-entry")).toBeVisible();
  const bounds = await page.locator("#time-editor").boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(1281);
  await page.screenshot({
    path: testInfo.outputPath("enlarged-time-editor.png"),
    fullPage: true,
  });
});
