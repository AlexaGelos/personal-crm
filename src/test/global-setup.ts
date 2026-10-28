// Runs once before all tests: creates the test database if it is missing and brings
// it up to date with the migrations from ./drizzle
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { databaseConfig } from "@/db/config";
import { assertTestDatabase, switchToTestDatabase } from "./database-name";

export default async function setup() {
  const testName = switchToTestDatabase();
  try {
    assertTestDatabase(testName);
  } catch (error) {
    // Vitest fails while printing an error thrown from here and hides its text: print it first
    console.error(error instanceof Error ? error.message : error);
    throw error;
  }
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
