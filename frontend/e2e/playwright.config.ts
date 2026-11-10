import { defineConfig, devices } from "@playwright/test";

/**
 * Campus Pulse end-to-end tests. They run against the composed stack (shell +
 * MFEs + Kong + Go services + Postgres + Fuseki) — start it first:
 *
 *   docker compose --profile backend up -d --build --wait   # repo root
 *   pnpm --filter @campus-pulse/e2e exec playwright install chromium
 *   pnpm --filter @campus-pulse/e2e test
 *
 * Overrides: E2E_BASE_URL (default http://localhost:3000),
 *            E2E_API_URL  (default http://localhost/api).
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // The stack and demo accounts are shared: serial workers keep seeded data sane.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./global.setup.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
