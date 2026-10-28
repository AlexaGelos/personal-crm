import "server-only";

import { asc, count, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { contactGroups, groups } from "@/db/schema";
import { groupNameKey } from "@/lib/validation";

// Shown to the owner, so they stay in Russian
export const GROUP_EXISTS = "Такая группа уже есть";

export type GroupResult = { id: number } | { error: string };

// All groups by name, each with the number of its contacts
export async function listGroups() {
  return db
    .select({ id: groups.id, name: groups.name, contactCount: count(contactGroups.contactId) })
    .from(groups)
    .leftJoin(contactGroups, eq(contactGroups.groupId, groups.id))
    .groupBy(groups.id)
    .orderBy(asc(groups.name), asc(groups.id));
}

export async function findGroup(id: number) {
  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  return group;
}

// The name is already checked by groupNameSchema. A name taken in any case or with "ё" / "е"
// swapped hits the unique index on the name key
export async function createGroup(name: string): Promise<GroupResult> {
  const [created] = await db
    .insert(groups)
    .values({ name })
    .onConflictDoNothing()
    .returning({ id: groups.id });

  return created ?? { error: GROUP_EXISTS };
}

// The group was deleted, e.g. in another tab
export const GROUP_GONE = "Этой группы больше нет — возможно, её удалили";

// Postgres error code of a broken unique index. Drizzle keeps the original error in "cause"
function isUniqueViolation(error: unknown) {
  const original = error instanceof Error && error.cause ? error.cause : error;
  return (
    typeof original === "object" &&
    original !== null &&
    "code" in original &&
    original.code === "23505"
  );
}

// Changing only the case or "ё" / "е" is fine: the index compares the row with the new value of itself
export async function renameGroup(id: number, name: string): Promise<GroupResult> {
  try {
    const [renamed] = await db
      .update(groups)
      .set({ name })
      .where(eq(groups.id, id))
      .returning({ id: groups.id });

    return renamed ?? { error: GROUP_GONE };
  } catch (error) {
    if (isUniqueViolation(error)) return { error: GROUP_EXISTS };
    throw error;
  }
}

// Contacts stay: only their links to the group are removed (ON DELETE CASCADE).
// A group that is already gone is not an error
export async function deleteGroup(id: number) {
  await db.delete(groups).where(eq(groups.id, id));
}

// The groups of one contact by name, for the card and for the edit form
export async function listContactGroups(contactId: number) {
  return db
    .select({ id: groups.id, name: groups.name })
    .from(contactGroups)
    .innerJoin(groups, eq(groups.id, contactGroups.groupId))
    .where(eq(contactGroups.contactId, contactId))
    .orderBy(asc(groups.name), asc(groups.id));
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The same key as in the unique index on groups.name
const nameKey = sql`lower(translate(${groups.name}, 'ёЁ', 'еЕ'))`;

// Makes the contact a member of exactly these groups, inside the transaction that saves the contact.
// groupIds are the checked groups, newGroupNames the names typed into "Новая группа" (already
// checked by groupNameSchema). A typed name that matches an existing group - in any case, with
// "ё" or "е" - joins that group instead of making a second one
export async function setContactGroups(
  tx: Transaction,
  contactId: number,
  { groupIds, newGroupNames }: { groupIds: number[]; newGroupNames: string[] },
) {
  const ids = new Set(groupIds);

  if (newGroupNames.length > 0) {
    await tx
      .insert(groups)
      .values(newGroupNames.map((name) => ({ name })))
      .onConflictDoNothing();

    const named = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(inArray(nameKey, newGroupNames.map(groupNameKey)));
    for (const { id } of named) ids.add(id);
  }

  await tx.delete(contactGroups).where(eq(contactGroups.contactId, contactId));

  if (ids.size > 0) {
    // Selected from groups, so a group deleted in another tab is skipped instead of failing the save
    await tx.insert(contactGroups).select(
      tx
        .select({
          contactId: sql<number>`${contactId}::integer`.as("contact_id"),
          groupId: groups.id,
        })
        .from(groups)
        .where(inArray(groups.id, [...ids])),
    );
  }
}
