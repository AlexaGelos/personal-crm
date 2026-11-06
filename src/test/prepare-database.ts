// Creates the test database if it is missing and brings it up to date with the
// migrations from ./drizzle. Shared by Vitest and Playwright
import postgres from "postgres";

import { databaseConfig } from "@/db/config";
import { runMigrations } from "@/db/run-migrations";
import { assertTestDatabase } from "./database-name";

// The owner of the rows an old test run may have left in the database: migration 0003 needs
// someone to hand them to. The tables are emptied before every test anyway
export const TEST_OWNER_EMAIL = "owner@example.test";

export async function prepareTestDatabase(testName: string) {
  assertTestDatabase(testName);
  const config = databaseConfig();

  // "postgres" is the maintenance database every server has: the test one may not exist yet
  const admin = postgres({ ...config, database: "postgres", max: 1, onnotice: () => {} });
  try {
    const [existing] = await admin`select 1 from pg_database where datname = ${testName}`;
    if (!existing) await admin`create database ${admin(testName)}`;
  } finally {
    await admin.end();
  }

  const sql = postgres({ ...config, max: 1, onnotice: () => {} });
  try {
    await runMigrations(sql, { ownerEmail: TEST_OWNER_EMAIL });
  } finally {
    await sql.end();
  }
}
