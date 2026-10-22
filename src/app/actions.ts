"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import {
  contactSchema,
  frequencySchema,
  idSchema,
  momentSchema,
  noteSchema,
  type ContactFields,
  type ContactFormState,
  type FrequencyFormState,
  type MarkContactedResult,
  type NoteFormState,
  type UndoContactedResult,
} from "@/lib/validation";

// The contact was deleted, e.g. in another tab
const CONTACT_GONE = "Этого контакта больше нет — возможно, его удалили";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readContactFields(formData: FormData): ContactFields {
  return {
    name: readText(formData, "name"),
    about: readText(formData, "about"),
    howWeMet: readText(formData, "howWeMet"),
    phone: readText(formData, "phone"),
    email: readText(formData, "email"),
  };
}

export async function createContact(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const values = readContactFields(formData);
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    return { values, errors: z.flattenError(parsed.error).fieldErrors };
  }

  const [created] = await db
    .insert(contacts)
    .values(parsed.data)
    .returning({ id: contacts.id });

  revalidatePath("/");
  redirect(`/contacts/${created.id}`);
}

export async function updateContact(
  contactId: number,
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const id = idSchema.parse(contactId);
  const values = readContactFields(formData);
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    return { values, errors: z.flattenError(parsed.error).fieldErrors };
  }

  const [updated] = await db
    .update(contacts)
    .set(parsed.data)
    .where(eq(contacts.id, id))
    .returning({ id: contacts.id });

  if (!updated) {
    return { values, message: CONTACT_GONE };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${id}`);
  redirect(`/contacts/${id}`);
}

export async function deleteContact(contactId: number) {
  const id = idSchema.parse(contactId);

  // Notes are removed by the ON DELETE CASCADE foreign key
  const [deleted] = await db
    .delete(contacts)
    .where(eq(contacts.id, id))
    .returning({ name: contacts.name });

  revalidatePath("/");
  // ?deleted= makes the list show a "contact deleted" message. Nothing was
  // deleted (e.g. already gone in another tab) - no message
  redirect(deleted ? `/?${new URLSearchParams({ deleted: deleted.name })}` : "/");
}

export async function addNote(
  contactId: number,
  _prevState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const id = idSchema.parse(contactId);
  const body = readText(formData, "body");
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return { body, error: parsed.error.issues[0]?.message };
  }

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.id, id));
  if (!contact) {
    return { body, error: CONTACT_GONE };
  }

  await db.insert(notes).values({ contactId: id, body: parsed.data });

  // A note is a contact too: the due date moves and the contact leaves "Пора связаться"
  revalidatePath("/");
  revalidatePath(`/contacts/${id}`);
  return {};
}

// One press on the frequency switch in the card; "none" clears the frequency
export async function setContactFrequency(
  contactId: number,
  _prevState: FrequencyFormState,
  formData: FormData,
): Promise<FrequencyFormState> {
  const id = idSchema.parse(contactId);
  const frequency = frequencySchema.parse(formData.get("frequency"));

  const [updated] = await db
    .update(contacts)
    .set({ contactFrequency: frequency })
    .where(eq(contacts.id, id))
    .returning({ id: contacts.id });

  if (!updated) {
    return { error: CONTACT_GONE };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${id}`);
  return {};
}

// "Связались": remembers "now" as the last contact without adding a note.
// Returns the old value, so the "Отмечено" message can undo the press
export async function markContacted(contactId: number): Promise<MarkContactedResult> {
  const id = idSchema.parse(contactId);

  const mark = await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ previous: contacts.lastContactedAt })
      .from(contacts)
      .where(eq(contacts.id, id))
      .for("update");
    if (!before) return null;

    // Milliseconds only: a JavaScript Date keeps no more, and the undo compares
    // the stored value with the one it got back from here
    const [after] = await tx
      .update(contacts)
      .set({ lastContactedAt: sql`date_trunc('milliseconds', now())` })
      .where(eq(contacts.id, id))
      .returning({ name: contacts.name, markedAt: contacts.lastContactedAt });

    return {
      contactId: id,
      name: after.name,
      previous: before.previous?.toISOString() ?? null,
      markedAt: after.markedAt!.toISOString(),
    };
  });

  if (!mark) {
    return { error: CONTACT_GONE };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${id}`);
  return { mark };
}

// "Отменить" in the "Отмечено" message: puts the old value back, but only while the field
// still holds this very press. Pressed again since then or the contact is gone - nothing changes
export async function undoContacted(
  contactId: number,
  previous: string | null,
  markedAt: string,
): Promise<UndoContactedResult> {
  const id = idSchema.parse(contactId);
  const previousAt = momentSchema.nullable().parse(previous);
  const markedAtValue = momentSchema.parse(markedAt);

  const [restored] = await db
    .update(contacts)
    .set({ lastContactedAt: previousAt === null ? null : new Date(previousAt) })
    .where(and(eq(contacts.id, id), eq(contacts.lastContactedAt, new Date(markedAtValue))))
    .returning({ id: contacts.id });

  if (!restored) {
    return { error: "Отменить уже не получится" };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${id}`);
  return {};
}
