import { defineConfig, devices } from "@playwright/test";

import { switchToTestDatabase } from "./src/test/database-name";

// The app under test talks to its own database, never to the working one.
// Set here, so the web server below and the tests (e2e/database.ts) both get it
switchToTestDatabase("e2e");

// The zone the server shows dates in (TZ in deploy/compose.yaml), for the app and the tests alike:
// the tests count the expected due dates with the app's own functions
const TIME_ZONE = "Europe/Moscow";
process.env.TZ = TIME_ZONE;

// Not 3000: a dev server or "pnpm start" on the working database may already be there
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  // One database for every test: they run one after another
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "ru-RU",
    timezoneId: TIME_ZONE,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A migrated database first, then the production build, as on the server
    command: `pnpm exec tsx e2e/prepare-database.ts && pnpm build && pnpm exec next start -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/health`,
    // Always our own server: one already on this port may use another database
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
