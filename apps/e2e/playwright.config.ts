import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const API_PORT = 4000;
const DASHBOARD_PORT = 3000;

// Starting both servers here (instead of expecting the caller to have `docker compose up` already
// running) makes `npx playwright test` self-contained given a migrated, reachable Postgres - see
// CONTRIBUTING.md for the local prerequisite. `reuseExistingServer` lets local runs reuse an
// already-running `docker compose up` stack instead of spawning a second copy.
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${DASHBOARD_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run start",
      cwd: path.resolve(__dirname, "../api"),
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        DATABASE_URL: process.env.DATABASE_URL ?? "postgres://feedbackhub:feedbackhub@localhost:5432/feedbackhub",
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "e2e-access-secret",
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "e2e-refresh-secret",
        SESSION_SECRET: process.env.SESSION_SECRET ?? "e2e-session-secret",
        CORS_ORIGINS: `http://localhost:${DASHBOARD_PORT}`,
        FRONTEND_URL: `http://localhost:${DASHBOARD_PORT}`,
        PORT: String(API_PORT),
        NODE_ENV: "production",
      },
    },
    {
      command: "npm run start",
      cwd: path.resolve(__dirname, "../dashboard"),
      url: `http://localhost:${DASHBOARD_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
