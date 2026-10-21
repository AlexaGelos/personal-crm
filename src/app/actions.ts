"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import {
  contactSchema,
  idSchema,
  noteSchema,
  type ContactFields,
  type ContactFormState,
  type NoteFormState,
} from "@/lib/validation";

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
    return { values, message: "Этого контакта больше нет — возможно, его удалили" };
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
    return { body, error: "Этого контакта больше нет — возможно, его удалили" };
  }

  await db.insert(notes).values({ contactId: id, body: parsed.data });

  revalidatePath(`/contacts/${id}`);
  return {};
}
