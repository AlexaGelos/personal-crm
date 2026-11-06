import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Tables of the login library (Better Auth): users, sessions, accounts and one-time tokens.
// The column names are ours (snake_case, like the rest); the library finds the columns by the
// property names, so those stay exactly as it expects them
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  // Not asked at login, stays empty
  name: text("name").notNull(),
  // Always lower case without spaces: the login form and the migration both bring it to that
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

// Empty: there are no passwords and no login through other services. The library's standard
// schema includes it, and leaving it out would break updates of the library
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)],
);

// One-time login links: the library keeps a row per link until it is opened or expires
export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

// One row per login email sent: the limit "3 emails per address in 10 minutes" counts them.
// The rows of verifications are deleted when a new link is requested, so they cannot be counted
export const loginEmailSends = pgTable(
  "login_email_sends",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    email: text("email").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("login_email_sends_email_idx").on(table.email, table.sentAt)],
);

// How often the owner wants to talk to a contact; NULL means "not set"
export const contactFrequency = pgEnum("contact_frequency", ["week", "month", "quarter", "year"]);

// A user is never deleted in the app, so contacts and groups have no ON DELETE CASCADE:
// data cannot be lost through the user row by accident
export const contacts = pgTable(
  "contacts",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
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
  },
  (table) => [index("contacts_user_id_idx").on(table.userId)],
);

// Notes belong to the owner of the contact: no column of their own
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
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Names are unique for each user, not for the whole database. Case and "ё" / "е" do not
    // tell names apart; the same key is built in groupNameKey(). Starts with user_id, so it
    // also serves the lookups of a user's groups
    uniqueIndex("groups_user_name_unique").on(
      table.userId,
      sql`lower(translate(${table.name}, 'ёЁ', 'еЕ'))`,
    ),
  ],
);

// A group is deleted - its contacts stay; a contact is deleted - it leaves its groups.
// The link has no owner of its own: it is the owner of the contact and of the group
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

export type User = typeof users.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type ContactFrequency = (typeof contactFrequency.enumValues)[number];
