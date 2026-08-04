// Playwright E2E config for Matrix One.
// Serves the built app with `vite preview`; every test stubs all /api/** calls (see e2e/fixtures.js)
// so NO real broker or market-data request is ever made. Run:  npm run build && npm run test:e2e
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  // R38-P1-02: 2 retries in CI so a single environment flake (cold preview server, first-paint timing) can't turn the
  // gate red; a genuinely broken assertion still fails all attempts. Locally retries stay 0 for fast feedback.
  retries: process.env.CI ? 2 : 0,
  // Emit a JUnit + HTML report in CI so a failure produces a downloadable trace/diagnosis artifact (not just a red X).
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }], ["junit", { outputFile: "test-results/junit.xml" }]] : [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",   // R38-P1-02: keep a trace for EVERY failure so the exact failing step is diagnosable
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Reuse an already-built dist. `npm run build` first, then this serves it on :4173.
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
