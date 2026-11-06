// Helpers shared by the test data scripts (seed.ts, seed-dante.ts)
import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { contactGroups, contacts, groups, users } from "./schema";

// The user the test data belongs to: the one with the email from OWNER_EMAIL, made if there is
// none yet. The same email handling as in migration 0003: no spaces at the edges, lower case.
// Called first in a script, so that without the setting nothing is added
export async function ensureOwner<TSchema extends Record<string, unknown>>(
  db: PostgresJsDatabase<TSchema>,
) {
  const email = (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
  if (!email) {
    throw new Error(
      "OWNER_EMAIL is not set: the test data belongs to the user with this email. Add OWNER_EMAIL to .env",
    );
  }
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) {
    throw new Error(`OWNER_EMAIL is not an email address: "${email}"`);
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) return existing.id;

  // The owner of the app typed this address in themselves: it counts as confirmed (as in the migration)
  const [created] = await db
    .insert(users)
    .values({ id: randomUUID(), name: "", email, emailVerified: true })
    .returning({ id: users.id });
  return created.id;
}

// Deterministic PRNG (mulberry32): the same seed always produces the same data
export function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

// What the group rules of a script look at
export type SeedGroupContact = { name: string; about: string | null; howWeMet: string | null };

// Case and "ё" / "е" do not tell group names apart: the key of the groups_name_unique index.
// The same as groupNameKey() in src/lib/validation.ts, which the scripts cannot import
const nameKey = sql<string>`lower(translate(${groups.name}, 'ёЁ', 'еЕ'))`;
const groupNameKey = (name: string) =>
  name.replace(/ё/g, "е").replace(/Ё/g, "Е").toLocaleLowerCase("ru");

// Puts the contacts of a script into its groups, once: if the marker group is there, nothing
// is done, so the marker must be a group that always gets contacts. Only the script's own
// contacts are touched: the generated name with the generated "Кто это". A group is made only
// when somebody goes into it; a group the owner has under the same name is used as it is.
// The groups a contact is already in stay. Everything is looked for and made for the one user:
// the contacts and groups of other users do not count and are not touched
export async function addSeedGroups<TSchema extends Record<string, unknown>>(
  db: PostgresJsDatabase<TSchema>,
  userId: string,
  {
    marker,
    seeded,
    groupsFor,
  }: {
    marker: string;
    seeded: { name: string; about: string | null }[];
    groupsFor: (contact: SeedGroupContact) => string[];
  },
) {
  const [{ done }] = await db
    .select({ done: sql<boolean>`count(*) > 0` })
    .from(groups)
    .where(and(eq(groups.userId, userId), inArray(nameKey, [groupNameKey(marker)])));
  if (done) return null;

  return db.transaction(async (tx) => {
    // A contact of the owner with the same name but another "Кто это" is not ours
    const wanted = new Map(seeded.map((contact) => [contact.name, contact.about]));
    const rows: (SeedGroupContact & { id: number })[] = [];
    for (const part of chunk([...wanted.keys()], 500)) {
      rows.push(
        ...(await tx
          .select({
            id: contacts.id,
            name: contacts.name,
            about: contacts.about,
            howWeMet: contacts.howWeMet,
          })
          .from(contacts)
          .where(and(eq(contacts.userId, userId), inArray(contacts.name, part)))),
      );
    }
    const memberships = rows
      .filter((row) => wanted.get(row.name) === row.about)
      .flatMap((row) => groupsFor(row).map((group) => ({ contactId: row.id, group })));

    const names = [...new Set(memberships.map((membership) => membership.group))];
    if (names.length === 0) return { groupCount: 0, linkCount: 0 };

    const created = await tx
      .insert(groups)
      .values(names.map((name) => ({ userId, name })))
      .onConflictDoNothing()
      .returning({ id: groups.id });
    const groupIdByKey = new Map(
      (
        await tx
          .select({ id: groups.id, key: nameKey })
          .from(groups)
          .where(and(eq(groups.userId, userId), inArray(nameKey, names.map(groupNameKey))))
      ).map((group) => [group.key, group.id]),
    );

    let linkCount = 0;
    const links = memberships.map(({ contactId, group }) => ({
      contactId,
      groupId: groupIdByKey.get(groupNameKey(group))!,
    }));
    for (const part of chunk(links, 500)) {
      const added = await tx
        .insert(contactGroups)
        .values(part)
        .onConflictDoNothing()
        .returning({ contactId: contactGroups.contactId });
      linkCount += added.length;
    }
    return { groupCount: created.length, linkCount };
  });
}
