import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  exists,
  getTableColumns,
  gt,
  ilike,
  isNotNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import { contactGroups, contacts, groups, notes } from "@/db/schema";
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
    ilike(sql`translate(${contacts.name}, 'ёЁ', 'еЕ')`, `%${escapeLike(foldYo(query))}%`),
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

// Only the contacts of the group; without a group - no condition. The group must be the
// user's own: a number of somebody else's group matches nothing
function groupCondition(userId: string, groupId: number | undefined): SQL | undefined {
  if (groupId === undefined) return undefined;

  return exists(
    db
      .select({ one: sql`1` })
      .from(contactGroups)
      .innerJoin(groups, eq(groups.id, contactGroups.groupId))
      .where(
        and(
          eq(contactGroups.contactId, contacts.id),
          eq(contactGroups.groupId, groupId),
          eq(groups.userId, userId),
        ),
      ),
  );
}

// Every query of this file starts from the user: the data of another user never gets into an
// answer, whatever numbers the request carries
export async function listContacts(
  userId: string,
  {
    query,
    limit,
    groupId,
  }: {
    query: string;
    limit: number;
    groupId?: number;
  },
) {
  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      about: contacts.about,
      phone: contacts.phone,
      email: contacts.email,
      // All groups of the contact, not only the selected one. A query builder, not plain columns
      // in sql``: in a select from one table Drizzle drops the table names, and "id" would be ambiguous
      groupNames: sql<string[]>`array(${db
        .select({ name: groups.name })
        .from(contactGroups)
        .innerJoin(groups, eq(groups.id, contactGroups.groupId))
        .where(and(eq(contactGroups.contactId, contacts.id), eq(groups.userId, userId)))
        .orderBy(asc(groups.name), asc(groups.id))})`,
    })
    .from(contacts)
    .where(
      and(eq(contacts.userId, userId), searchCondition(query), groupCondition(userId, groupId)),
    )
    .orderBy(asc(contacts.name), asc(contacts.id))
    .limit(limit);
}

// Counts contacts matching the query, in the group if there is one;
// an empty query counts all of them
export async function countContacts(userId: string, query = "", groupId?: number) {
  return db.$count(
    contacts,
    and(eq(contacts.userId, userId), searchCondition(query), groupCondition(userId, groupId)),
  );
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

export async function getContact(userId: string, id: number) {
  const [contact] = await db
    .select({ ...getTableColumns(contacts), ...keepInTouchFields() })
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
  return contact;
}

// Overdue contacts, the most overdue first; without a limit - all of them. With a group - only
// the contacts of that group. Every row also carries the number of all overdue contacts
// (of the group, if there is one)
export async function listOverdueContacts(userId: string, limit?: number, groupId?: number) {
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
    .where(
      and(
        eq(contacts.userId, userId),
        isNotNull(contacts.contactFrequency),
        groupCondition(userId, groupId),
      ),
    )
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

// The notes belong to the owner of the contact: of a foreign contact there are none to give
export async function listNotes(userId: string, contactId: number) {
  return db
    .select(getTableColumns(notes))
    .from(notes)
    .innerJoin(contacts, eq(contacts.id, notes.contactId))
    .where(and(eq(notes.contactId, contactId), eq(contacts.userId, userId)))
    .orderBy(desc(notes.createdAt), desc(notes.id));
}
