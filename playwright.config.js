import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./browser-tests",
  timeout: 30000,
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:49168",
    timezoneId: "Europe/Copenhagen",
    screenshot: "only-on-failure",
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "node scripts/serve.mjs",
        env: { PORT: "49168", SITE_ROOT: "dist" },
        url: "http://127.0.0.1:49168",
        reuseExistingServer: false,
      },
});
