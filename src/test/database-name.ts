import { loadLocalEnv } from "@/db/config";

const TEST_SUFFIX = "_test";

// Tests never run on the working database: they get their own one in the same Postgres,
// named after the working one, so .env needs no extra lines.
// Vitest uses <name>_test, Playwright <name>_e2e_test: both can run at the same time
export function switchToTestDatabase(kind: "unit" | "e2e" = "unit") {
  loadLocalEnv();

  const name = process.env.POSTGRES_DB;
  if (!name) {
    throw new Error("POSTGRES_DB is not set: add it to .env before running the tests");
  }

  const suffix = kind === "e2e" ? `_e2e${TEST_SUFFIX}` : TEST_SUFFIX;
  const testName = name.endsWith(suffix) ? name : `${name}${suffix}`;
  process.env.POSTGRES_DB = testName;
  return testName;
}

// Last guard before the tests wipe the tables
export function assertTestDatabase(name: string) {
  if (!name.endsWith(TEST_SUFFIX)) {
    throw new Error(
      `Refusing to run tests on database "${name}": its name must end with "${TEST_SUFFIX}"`,
    );
  }
}
