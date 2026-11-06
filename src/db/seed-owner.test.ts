// The commands pnpm db:seed and pnpm db:seed:dante themselves, run as processes on the test
// database: they give the test data to the user with the email from OWNER_EMAIL
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { contacts, groups, notes, users } from "@/db/schema";
import { GROUPS_MARKER as DANTE_MARKER } from "@/db/seed-dante-data";
import { GROUPS_MARKER } from "@/db/seed-data";
import { addContact, addGroup, addUser, TEST_USER_ID } from "@/test/helpers";

const run = promisify(execFile);

const OWNER_EMAIL = "seed-owner@example.com";

const scripts = [
  { name: "pnpm db:seed", file: "src/db/seed.ts", marker: GROUPS_MARKER, contactCount: 1000 },
  {
    name: "pnpm db:seed:dante",
    file: "src/db/seed-dante.ts",
    marker: DANTE_MARKER,
    contactCount: 500,
  },
];

// The script in its own process with the settings of the test: POSTGRES_DB is already the test
// database here. OWNER_EMAIL is given even when empty, so a real one in .env never gets in
async function runSeed(file: string, ownerEmail: string) {
  try {
    const { stdout } = await run(process.execPath, ["--import", "tsx", file], {
      env: { ...process.env, OWNER_EMAIL: ownerEmail },
      timeout: 120_000,
    });
    return { code: 0, output: stdout };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failed.code ?? 1, output: `${failed.stdout ?? ""}${failed.stderr ?? ""}` };
  }
}

async function ownerId() {
  const [owner] = await db.select().from(users).where(eq(users.email, OWNER_EMAIL));
  return owner?.id;
}

describe.each(scripts)("$name", ({ file, marker, contactCount }) => {
  it("makes the user with the email from the setting and gives them everything", async () => {
    const result = await runSeed(file, OWNER_EMAIL);

    expect(result.code, result.output).toBe(0);
    const owner = await ownerId();
    expect(owner).toBeDefined();
    const [owner_] = await db.select().from(users).where(eq(users.id, owner!));
    expect(owner_.emailVerified).toBe(true);

    const allContacts = await db.select().from(contacts);
    const allGroups = await db.select().from(groups);
    expect(allContacts).toHaveLength(contactCount);
    expect(allContacts.every((contact) => contact.userId === owner)).toBe(true);
    expect(allGroups.length).toBeGreaterThan(0);
    expect(allGroups.every((group) => group.userId === owner)).toBe(true);
    expect((await db.select().from(notes)).length).toBeGreaterThan(0);
  }, 120_000);

  it("uses the user that is already there instead of making a second one", async () => {
    const existing = await addUser(OWNER_EMAIL);

    const result = await runSeed(file, `  ${OWNER_EMAIL.toUpperCase()}  `);

    expect(result.code, result.output).toBe(0);
    expect(await db.select().from(users).where(eq(users.email, OWNER_EMAIL))).toHaveLength(1);
    expect((await db.select().from(contacts))[0].userId).toBe(existing.id);
  }, 120_000);

  it("fails with a clear message and adds nothing without the setting", async () => {
    const result = await runSeed(file, "");

    expect(result.code).not.toBe(0);
    expect(result.output).toContain("OWNER_EMAIL");
    expect(await db.select().from(contacts)).toEqual([]);
    expect(await db.select().from(groups)).toEqual([]);
    // Only the user every test has
    expect((await db.select().from(users)).map((user) => user.id)).toEqual([TEST_USER_ID]);
  }, 120_000);

  it("leaves the contacts and the group of another user alone", async () => {
    // Another user has a group with the name the script uses as its marker, and a contact
    const other = await addUser("other@example.com");
    const otherGroup = await addGroup(other.id, marker);
    const otherContact = await addContact(other.id, "Анна Иванова");

    const result = await runSeed(file, OWNER_EMAIL);

    expect(result.code, result.output).toBe(0);
    const owner = await ownerId();
    // The data of the owner is made all the same: the group of another user does not count
    const ownerContacts = await db.select().from(contacts).where(eq(contacts.userId, owner!));
    expect(ownerContacts).toHaveLength(contactCount);
    const ownerGroups = await db.select().from(groups).where(eq(groups.userId, owner!));
    expect(ownerGroups.map((group) => group.name)).toContain(marker);

    expect(await db.select().from(contacts).where(eq(contacts.userId, other.id))).toEqual([
      otherContact,
    ]);
    expect(await db.select().from(groups).where(eq(groups.userId, other.id))).toEqual([otherGroup]);
  }, 120_000);

  it("adds nothing the second time", async () => {
    await runSeed(file, OWNER_EMAIL);
    const before = {
      contacts: (await db.select().from(contacts)).length,
      groups: (await db.select().from(groups)).length,
      notes: (await db.select().from(notes)).length,
    };

    const result = await runSeed(file, OWNER_EMAIL);

    expect(result.code, result.output).toBe(0);
    expect({
      contacts: (await db.select().from(contacts)).length,
      groups: (await db.select().from(groups)).length,
      notes: (await db.select().from(notes)).length,
    }).toEqual(before);
  }, 120_000);
});
