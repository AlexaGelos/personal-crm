import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// How often the owner wants to talk to a contact; NULL means "not set"
export const contactFrequency = pgEnum("contact_frequency", ["week", "month", "quarter", "year"]);

export const contacts = pgTable("contacts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  // Who this person is: occupation, role, how to recognize them
  about: text("about"),
  howWeMet: text("how_we_met"),
  phone: text("phone"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  contactFrequency: contactFrequency("contact_frequency"),
  // Last press of "Связались"; NULL - never pressed
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
});

export const notes = pgTable(
  "notes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notes_contact_id_idx").on(table.contactId, table.createdAt)],
);

// Groups the owner makes up ("Семья", "Теннис"); a contact can be in any number of them
export const groups = pgTable(
  "groups",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Case and "ё" / "е" do not tell names apart; the same key is built in groupNameKey()
    uniqueIndex("groups_name_unique").on(sql`lower(translate(${table.name}, 'ёЁ', 'еЕ'))`),
  ],
);

// A group is deleted - its contacts stay; a contact is deleted - it leaves its groups
export const contactGroups = pgTable(
  "contact_groups",
  {
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.contactId, table.groupId] }),
    index("contact_groups_group_id_idx").on(table.groupId),
  ],
);

export type Contact = typeof contacts.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type ContactFrequency = (typeof contactFrequency.enumValues)[number];
