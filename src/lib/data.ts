import "server-only";

import { asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// "ё" is often typed as "е": compare names with both folded to "е"
function foldYo(value: string) {
  return value.replace(/ё/g, "е").replace(/Ё/g, "Е");
}

// Matches the query against name, phone and email, case-insensitive
function searchCondition(query: string): SQL | undefined {
  if (!query) return undefined;

  const pattern = `%${escapeLike(query)}%`;
  const conditions = [
    ilike(
      sql`translate(${contacts.name}, 'ёЁ', 'еЕ')`,
      `%${escapeLike(foldYo(query))}%`,
    ),
    ilike(contacts.phone, pattern),
    ilike(contacts.email, pattern),
  ];

  // "916 123" should find "+7 (916) 123-45-67": compare digits only
  const digits = query.replace(/\D/g, "");
  if (digits && /^[\d\s+()-]+$/.test(query)) {
    conditions.push(
      sql`regexp_replace(${contacts.phone}, '[^0-9]', '', 'g') like ${`%${digits}%`}`,
    );
  }

  return or(...conditions);
}

export async function listContacts(query: string) {
  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      phone: contacts.phone,
      email: contacts.email,
    })
    .from(contacts)
    .where(searchCondition(query))
    .orderBy(asc(contacts.name), asc(contacts.id));
}

export async function countContacts() {
  return db.$count(contacts);
}

export async function getContact(id: number) {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id));
  return contact;
}

export async function listNotes(contactId: number) {
  return db
    .select()
    .from(notes)
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}
