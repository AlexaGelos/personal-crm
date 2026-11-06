// Direct access to the e2e database: empty it before a test and put rows into it.
// Not "@/db": that one is for the app and refuses to load outside Next.js
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { databaseConfig } from "@/db/config";
import {
  contactGroups,
  contacts,
  groups,
  loginEmailSends,
  notes,
  sessions,
  users,
  verifications,
} from "@/db/schema";
import { assertTestDatabase, switchToTestDatabase } from "@/test/database-name";

switchToTestDatabase("e2e");

// The user every test starts with, as the owner is in a real database after the migration:
// the data the tests put in belongs to them, and signIn() logs them in
export const DEFAULT_USER_ID = "e2e-default-user";
export const DEFAULT_USER_EMAIL = "e2e-owner@example.com";

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
  if (tables.length > 0) {
    await database().execute(
      sql.raw(
        `truncate table ${tables.map((table) => table.name).join(", ")} restart identity cascade`,
      ),
    );
  }

  await database()
    .insert(users)
    .values({ id: DEFAULT_USER_ID, name: "", email: DEFAULT_USER_EMAIL, emailVerified: true });
}

// A second user, for the tests about two people
export async function addUser(email: string) {
  const [user] = await database()
    .insert(users)
    .values({ id: crypto.randomUUID(), name: "", email, emailVerified: true })
    .returning();
  return user;
}

// The data goes to the default user unless the test names another owner
export async function addContacts(names: string[], userId = DEFAULT_USER_ID) {
  return database()
    .insert(contacts)
    .values(names.map((name) => ({ userId, name })))
    .returning();
}

// One contact with any other fields: a frequency, the day it was added, the last «Связались»
export async function addContact(name: string, fields: Partial<typeof contacts.$inferInsert> = {}) {
  const [contact] = await database()
    .insert(contacts)
    .values({ userId: DEFAULT_USER_ID, name, ...fields })
    .returning();
  return contact;
}

export async function addGroup(name: string, userId = DEFAULT_USER_ID) {
  const [group] = await database().insert(groups).values({ userId, name }).returning();
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

// --- What the login left in the database, and moving time there ---
// Time is moved in the database, not waited for: the tests cannot sit for 15 minutes or 30 days

export async function usersWithEmail(email: string) {
  return database().select().from(users).where(eq(users.email, email));
}

export async function sessionsOf(email: string) {
  return database()
    .select({ id: sessions.id, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(users.email, email));
}

// The term of every session of the user, as it will be in `daysFromNow` days
export async function setSessionTerm(email: string, expiresAt: Date) {
  await database()
    .update(sessions)
    .set({ expiresAt })
    .where(
      eq(sessions.userId, sql`(select ${users.id} from ${users} where ${users.email} = ${email})`),
    );
}

// The term of every login link of the address (a link is a row of "verifications")
export async function setLinkTerm(email: string, expiresAt: Date) {
  await database()
    .update(verifications)
    .set({ expiresAt })
    .where(sql`${verifications.value}::jsonb ->> 'email' = ${email}`);
}

export async function liveLinksOf(email: string) {
  return database()
    .select()
    .from(verifications)
    .where(sql`${verifications.value}::jsonb ->> 'email' = ${email}`);
}

// Makes every email to the address look as if it had been sent `minutes` minutes ago
export async function ageEmailLog(email: string, minutes: number) {
  await database()
    .update(loginEmailSends)
    .set({ sentAt: sql`${loginEmailSends.sentAt} - make_interval(mins => ${minutes})` })
    .where(eq(loginEmailSends.email, email));
}

export async function countContactsOf(userId: string) {
  return database().$count(contacts, eq(contacts.userId, userId));
}

export async function closeDatabase() {
  await connection?.client.end();
  connection = undefined;
}
