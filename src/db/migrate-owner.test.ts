// The login migration (0003) gives every existing contact and group an owner. It runs on a
// database of its own, brought to the state "before login" first: the usual test database
// is already fully migrated and emptied before each test
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { databaseConfig } from "@/db/config";
import { runMigrations } from "@/db/run-migrations";
import { assertTestDatabase } from "@/test/database-name";

const DATABASE = `${databaseConfig().database.replace(/_test$/, "")}_migrate_test`;
const LAST_OLD_MIGRATION = 2;

let admin: postgres.Sql;
let sql: postgres.Sql;
let oldMigrations: string;

// A copy of ./drizzle with the journal cut after the last migration before login
function copyOldMigrations() {
  const folder = mkdtempSync(join(tmpdir(), "old-migrations-"));
  mkdirSync(join(folder, "meta"));

  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
  journal.entries = journal.entries.slice(0, LAST_OLD_MIGRATION + 1);
  writeFileSync(join(folder, "meta", "_journal.json"), JSON.stringify(journal));
  for (const entry of journal.entries) {
    cpSync(join("drizzle", `${entry.tag}.sql`), join(folder, `${entry.tag}.sql`));
  }
  return folder;
}

// What was in the database before: some contacts, notes, groups and links between them
async function addOldData() {
  await sql`insert into contacts (name, about, phone, contact_frequency, last_contacted_at) values
    ('Анна Иванова', 'Врач', '+7 916 123-45-67', 'month', '2026-10-01T10:00:00Z'),
    ('Борис Петров', null, null, null, null),
    ('Вера Сидорова', 'Тренер', null, 'week', null)`;
  await sql`insert into notes (contact_id, body, created_at) values
    (1, 'Обсудили отпуск', '2026-09-01T10:00:00Z'),
    (1, 'Позвонила сама', '2026-09-20T10:00:00Z'),
    (3, 'Договорились о встрече', '2026-10-05T10:00:00Z')`;
  await sql`insert into groups (name) values ('Семья'), ('Теннис')`;
  await sql`insert into contact_groups (contact_id, group_id) values (1, 1), (2, 2), (3, 2)`;
}

// Every column of the old tables, the same before and after the migration
async function snapshot() {
  return {
    contacts: await sql`select id, name, about, how_we_met, phone, email, created_at,
      contact_frequency, last_contacted_at from contacts order by id`,
    notes: await sql`select * from notes order by id`,
    groups: await sql`select id, name, created_at from groups order by id`,
    links: await sql`select * from contact_groups order by contact_id, group_id`,
  };
}

// The text of a failed migration: Drizzle wraps the database error
function failureText(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  return `${error.message}\n${error.cause instanceof Error ? error.cause.message : ""}`;
}

beforeAll(async () => {
  assertTestDatabase(DATABASE);
  admin = postgres({ ...databaseConfig(), database: "postgres", max: 1, onnotice: () => {} });
  oldMigrations = copyOldMigrations();
});

afterAll(async () => {
  await admin.end();
  rmSync(oldMigrations, { recursive: true, force: true });
});

beforeEach(async () => {
  // A fresh database for every test, at the state before login
  await admin`drop database if exists ${admin(DATABASE)} with (force)`;
  await admin`create database ${admin(DATABASE)}`;
  sql = postgres({ ...databaseConfig(), database: DATABASE, max: 1, onnotice: () => {} });
  await migrate(drizzle(sql), { migrationsFolder: oldMigrations });
});

afterEach(async () => {
  await sql.end();
});

describe("migration 0003: owner of the existing data", () => {
  it("gives all contacts and groups to the owner and loses nothing", async () => {
    await addOldData();
    const before = await snapshot();

    await runMigrations(sql, { ownerEmail: "owner@example.com" });

    const after = await snapshot();
    expect(after.contacts).toHaveLength(3);
    expect(after.notes).toHaveLength(3);
    expect(after.groups).toHaveLength(2);
    expect(after.links).toHaveLength(3);
    // The fields of the records did not change
    expect(after).toEqual(before);

    const users = await sql`select id, email, email_verified from users`;
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("owner@example.com");
    expect(users[0].email_verified).toBe(true);

    const [owned] = await sql`select
      (select count(*) from contacts where user_id = ${users[0].id})::int as contacts,
      (select count(*) from groups where user_id = ${users[0].id})::int as groups`;
    expect(owned).toEqual({ contacts: 3, groups: 2 });
  });

  it("writes the email in lower case without spaces", async () => {
    await addOldData();

    await runMigrations(sql, { ownerEmail: "  Owner@Example.COM \t" });

    const users = await sql`select email from users`;
    expect(users.map((user) => user.email)).toEqual(["owner@example.com"]);
  });

  it("fails and changes nothing when there is data and no email", async () => {
    await addOldData();
    const before = await snapshot();

    const error = await runMigrations(sql, {}).then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(failureText(error)).toContain("OWNER_EMAIL");
    // All or nothing: no new tables, no new column, the old data as it was
    expect(await sql`select to_regclass('users') as users`).toEqual([{ users: null }]);
    expect(
      await sql`select 1 from information_schema.columns
      where table_name = 'contacts' and column_name = 'user_id'`,
    ).toHaveLength(0);
    expect(await snapshot()).toEqual(before);
  });

  it("fails on an email that is not an address", async () => {
    await addOldData();

    const error = await runMigrations(sql, { ownerEmail: "not-an-address" }).then(
      () => null,
      (reason: unknown) => reason,
    );

    expect(failureText(error)).toContain("OWNER_EMAIL");
    expect(await sql`select to_regclass('users') as users`).toEqual([{ users: null }]);
  });

  it("passes on an empty database without the email and creates no user", async () => {
    await runMigrations(sql, {});

    const [{ count }] = await sql`select count(*)::int as count from users`;
    expect(count).toBe(0);
  });

  it("does not create a user for an empty database even with the email", async () => {
    await runMigrations(sql, { ownerEmail: "owner@example.com" });

    const [{ count }] = await sql`select count(*)::int as count from users`;
    expect(count).toBe(0);
  });
});
