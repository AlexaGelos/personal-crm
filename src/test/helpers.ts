// Quick ways to put rows into the test database
import { db } from "@/db";
import { contactGroups, contacts, groups, notes, users } from "@/db/schema";

// The user every test has by default: created again before each test (see setup.ts).
// Tests about two users make the second one with addUser()
export const TEST_USER_ID = "test-user";
export const TEST_USER_EMAIL = "test@example.com";

export async function addUser(email: string) {
  const [user] = await db
    .insert(users)
    .values({ id: crypto.randomUUID(), name: "", email, emailVerified: true })
    .returning();
  return user;
}

export async function createTestUser() {
  const [user] = await db
    .insert(users)
    .values({ id: TEST_USER_ID, name: "", email: TEST_USER_EMAIL, emailVerified: true })
    .returning();
  return user;
}

export async function addContact(
  userId: string,
  name: string,
  fields: Partial<typeof contacts.$inferInsert> = {},
) {
  const [contact] = await db
    .insert(contacts)
    .values({ userId, name, ...fields })
    .returning();
  return contact;
}

export async function addGroup(userId: string, name: string) {
  const [group] = await db.insert(groups).values({ userId, name }).returning();
  return group;
}

// Notes and links belong to the owner of the contact: no owner of their own
export async function addNote(contactId: number, body: string, createdAt?: Date) {
  const [note] = await db.insert(notes).values({ contactId, body, createdAt }).returning();
  return note;
}

export async function addToGroup(contactId: number, groupId: number) {
  await db.insert(contactGroups).values({ contactId, groupId });
}
