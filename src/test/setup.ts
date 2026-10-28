// Runs in every test file before its tests: points the app at the test database
// and empties it before each test
import { sql } from "drizzle-orm";
import { beforeEach } from "vitest";

import { databaseConfig } from "@/db/config";
import { db } from "@/db";
import { assertTestDatabase, switchToTestDatabase } from "./database-name";

switchToTestDatabase();
assertTestDatabase(databaseConfig().database);

beforeEach(async () => {
  // The guard runs again right before the wipe, in case something changed the setting
  assertTestDatabase(databaseConfig().database);

  // Every table of the app; the migrations journal lives in its own "drizzle" schema
  const tables = await db.execute<{ name: string }>(
    sql`select quote_ident(tablename) as name from pg_tables where schemaname = 'public'`,
  );
  if (tables.length === 0) return;

  await db.execute(
    sql.raw(
      `truncate table ${tables.map((table) => table.name).join(", ")} restart identity cascade`,
    ),
  );
});
