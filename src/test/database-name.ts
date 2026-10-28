import { loadLocalEnv } from "@/db/config";

const TEST_SUFFIX = "_test";

// Tests never run on the working database: they get their own one in the same Postgres,
// named after the working one, so .env needs no extra lines
export function switchToTestDatabase() {
  loadLocalEnv();

  const name = process.env.POSTGRES_DB;
  if (!name) {
    throw new Error("POSTGRES_DB is not set: add it to .env before running the tests");
  }

  const testName = name.endsWith(TEST_SUFFIX) ? name : `${name}${TEST_SUFFIX}`;
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
