// Quick ways to put rows into the test database
import { db } from "@/db";
import { contactGroups, contacts, groups, notes } from "@/db/schema";

export async function addContact(name: string, fields: Partial<typeof contacts.$inferInsert> = {}) {
  const [contact] = await db
    .insert(contacts)
    .values({ name, ...fields })
    .returning();
  return contact;
}

export async function addGroup(name: string) {
  const [group] = await db.insert(groups).values({ name }).returning();
  return group;
}

export async function addNote(contactId: number, body: string) {
  const [note] = await db.insert(notes).values({ contactId, body }).returning();
  return note;
}

export async function addToGroup(contactId: number, groupId: number) {
  await db.insert(contactGroups).values({ contactId, groupId });
}
