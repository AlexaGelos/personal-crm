// Helpers shared by the test data scripts (seed.ts, seed-dante.ts)
import { inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { contactGroups, contacts, groups } from "./schema";

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
// The groups a contact is already in stay
export async function addSeedGroups<TSchema extends Record<string, unknown>>(
  db: PostgresJsDatabase<TSchema>,
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
    .where(inArray(nameKey, [groupNameKey(marker)]));
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
          .where(inArray(contacts.name, part))),
      );
    }
    const memberships = rows
      .filter((row) => wanted.get(row.name) === row.about)
      .flatMap((row) => groupsFor(row).map((group) => ({ contactId: row.id, group })));

    const names = [...new Set(memberships.map((membership) => membership.group))];
    if (names.length === 0) return { groupCount: 0, linkCount: 0 };

    const created = await tx
      .insert(groups)
      .values(names.map((name) => ({ name })))
      .onConflictDoNothing()
      .returning({ id: groups.id });
    const groupIdByKey = new Map(
      (
        await tx
          .select({ id: groups.id, key: nameKey })
          .from(groups)
          .where(inArray(nameKey, names.map(groupNameKey)))
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
