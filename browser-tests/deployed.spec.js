import { test, expect } from "@playwright/test";
test("deployed application boots without script errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await expect(page.locator("#save-status")).toHaveText("Saved on this device");
  await expect(page.locator("#clocks .clock")).toHaveCount(2);
  await expect(page.locator("#app-version")).toContainText("Version 2.0-");
  expect(errors).toEqual([]);
});
