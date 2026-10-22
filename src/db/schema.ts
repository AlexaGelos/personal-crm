import { index, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// How often the owner wants to talk to a contact; NULL means "not set"
export const contactFrequency = pgEnum("contact_frequency", [
  "week",
  "month",
  "quarter",
  "year",
]);

export const contacts = pgTable("contacts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  // Who this person is: occupation, role, how to recognize them
  about: text("about"),
  howWeMet: text("how_we_met"),
  phone: text("phone"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("notes_contact_id_idx").on(table.contactId, table.createdAt)],
);

export type Contact = typeof contacts.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type ContactFrequency = (typeof contactFrequency.enumValues)[number];
