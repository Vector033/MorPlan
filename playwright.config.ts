import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
// E2E_BASE_URL=https://morplan.vercel.app runs the suite against a deployment instead of a local server.
const remote = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: remote ?? `http://localhost:${port}`, trace: "retain-on-failure", locale: "th-TH" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: remote
    ? undefined
    : {
    command: process.env.CI ? `npx next start -p ${port}` : `npx next dev -p ${port}`,
    port,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
