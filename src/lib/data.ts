import "server-only";

import {
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  ilike,
  isNotNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import { appTimeZone } from "@/lib/format";

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

export async function listContacts(query: string, limit: number) {
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
    .orderBy(asc(contacts.name), asc(contacts.id))
    .limit(limit);
}

// Counts contacts matching the query; an empty query counts all of them
export async function countContacts(query = "") {
  return db.$count(contacts, searchCondition(query));
}

// When it's time to get in touch, counted by the database for the card and the home block alike.
// Days are taken in the zone the dates are shown in, so the due date matches the note dates.
function keepInTouchFields() {
  const timeZone = appTimeZone();

  // The newest note or the last "Связались", whichever is later; with neither -
  // the day the contact was added. greatest() skips NULLs
  const lastContactAt = sql`coalesce(greatest((select max(${notes.createdAt}) from ${notes} where ${notes.contactId} = ${contacts.id}), ${contacts.lastContactedAt}), ${contacts.createdAt})`;

  // Month, quarter and year are calendar ones: Jan 31 + 1 month = Feb 28
  const period = sql`case ${contacts.contactFrequency}
    when 'week' then interval '7 days'
    when 'month' then interval '1 month'
    when 'quarter' then interval '3 months'
    when 'year' then interval '1 year'
  end`;

  // NULL when the frequency is not set
  const dueDate = sql`((${lastContactAt} at time zone ${timeZone})::date + ${period})::date`;
  const today = sql`(now() at time zone ${timeZone})::date`;

  return {
    // Text, not a Date: parsing "2026-11-15" as a moment could shift it by a day
    dueDate: sql<string | null>`to_char(${dueDate}, 'YYYY-MM-DD')`,
    // Days past the due date; zero or less - not overdue yet
    overdueDays: sql<number | null>`${today} - ${dueDate}`,
  };
}

export async function getContact(id: number) {
  const [contact] = await db
    .select({ ...getTableColumns(contacts), ...keepInTouchFields() })
    .from(contacts)
    .where(eq(contacts.id, id));
  return contact;
}

// Overdue contacts, the most overdue first; without a limit - all of them.
// Every row also carries the number of all overdue contacts
export async function listOverdueContacts(limit?: number) {
  const { overdueDays } = keepInTouchFields();
  const due = db
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      lastContactedAt: contacts.lastContactedAt,
      overdueDays: overdueDays.as("overdue_days"),
    })
    .from(contacts)
    .where(isNotNull(contacts.contactFrequency))
    .as("due");

  const query = db
    .select({
      id: due.id,
      name: due.name,
      about: due.about,
      lastContactedAt: due.lastContactedAt,
      overdueDays: sql<number>`${due.overdueDays}`,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(due)
    .where(gt(due.overdueDays, 0))
    .orderBy(desc(due.overdueDays), asc(due.name), asc(due.id));

  return limit === undefined ? query : query.limit(limit);
}

export async function listNotes(contactId: number) {
  return db
    .select()
    .from(notes)
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}
