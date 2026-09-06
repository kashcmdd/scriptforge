const { defineConfig } = require("@playwright/test");

const PORT = 3100;

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_PATH: "e2e-data.sqlite",
    },
  },
});