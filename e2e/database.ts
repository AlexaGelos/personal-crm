// Direct access to the e2e database: empty it before a test and put rows into it.
// Not "@/db": that one is for the app and refuses to load outside Next.js
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { databaseConfig } from "@/db/config";
import { contactGroups, contacts, groups, notes } from "@/db/schema";
import { assertTestDatabase, switchToTestDatabase } from "@/test/database-name";

switchToTestDatabase("e2e");

// Opened on first use and again after closeDatabase(): the test files run one after another
// in the same worker, and each one closes the connection when it is done
let connection: { client: postgres.Sql; db: ReturnType<typeof drizzle> } | undefined;

function database() {
  if (!connection) {
    const client = postgres({ ...databaseConfig(), max: 1, onnotice: () => {} });
    connection = { client, db: drizzle(client) };
  }
  return connection.db;
}

export async function clearDatabase() {
  // The guard right before the wipe
  assertTestDatabase(databaseConfig().database);

  // Every table of the app; the migrations journal lives in its own "drizzle" schema
  const tables = await database().execute<{ name: string }>(
    sql`select quote_ident(tablename) as name from pg_tables where schemaname = 'public'`,
  );
  if (tables.length === 0) return;

  await database().execute(
    sql.raw(
      `truncate table ${tables.map((table) => table.name).join(", ")} restart identity cascade`,
    ),
  );
}

export async function addContacts(names: string[]) {
  return database()
    .insert(contacts)
    .values(names.map((name) => ({ name })))
    .returning();
}

// One contact with any other fields: a frequency, the day it was added, the last «Связались»
export async function addContact(name: string, fields: Partial<typeof contacts.$inferInsert> = {}) {
  const [contact] = await database()
    .insert(contacts)
    .values({ name, ...fields })
    .returning();
  return contact;
}

export async function addGroup(name: string) {
  const [group] = await database().insert(groups).values({ name }).returning();
  return group;
}

export async function addToGroup(contactId: number, groupId: number) {
  await database().insert(contactGroups).values({ contactId, groupId });
}

export async function addNotes(contactId: number, bodies: string[]) {
  await database()
    .insert(notes)
    .values(bodies.map((body) => ({ contactId, body })));
}

export async function closeDatabase() {
  await connection?.client.end();
  connection = undefined;
}
