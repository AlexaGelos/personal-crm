// Direct access to the e2e database: empty it before a test and put rows into it.
// Not "@/db": that one is for the app and refuses to load outside Next.js
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { databaseConfig } from "@/db/config";
import { contacts, notes } from "@/db/schema";
import { assertTestDatabase, switchToTestDatabase } from "@/test/database-name";

switchToTestDatabase("e2e");

const client = postgres({ ...databaseConfig(), max: 1, onnotice: () => {} });
const db = drizzle(client);

export async function clearDatabase() {
  // The guard right before the wipe
  assertTestDatabase(databaseConfig().database);

  // Every table of the app; the migrations journal lives in its own "drizzle" schema
  const tables = await db.execute<{ name: string }>(
    sql`select quote_ident(tablename) as name from pg_tables where schemaname = 'public'`,
  );
  if (tables.length === 0) return;

  await db.execute(
    sql.raw(`truncate table ${tables.map((table) => table.name).join(", ")} restart identity cascade`),
  );
}

export async function addContacts(names: string[]) {
  return db.insert(contacts).values(names.map((name) => ({ name }))).returning();
}

export async function addNotes(contactId: number, bodies: string[]) {
  await db.insert(notes).values(bodies.map((body) => ({ contactId, body })));
}

export async function closeDatabase() {
  await client.end();
}
