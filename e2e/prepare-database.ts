// Runs before the app starts (webServer in playwright.config.ts): the e2e database must
// exist and be migrated by then. Playwright starts the web server before globalSetup,
// so this cannot live there
import { switchToTestDatabase } from "@/test/database-name";
import { prepareTestDatabase } from "@/test/prepare-database";

prepareTestDatabase(switchToTestDatabase("e2e")).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
