// Creates the test database if it is missing and brings it up to date with the
// migrations from ./drizzle. Shared by Vitest and Playwright
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { databaseConfig } from "@/db/config";
import { assertTestDatabase } from "./database-name";

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
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  } finally {
    await sql.end();
  }
}
