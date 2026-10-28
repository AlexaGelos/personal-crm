"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import {
  createGroup as insertGroup,
  deleteGroup as removeGroup,
  renameGroup as updateGroup,
  setContactGroups,
} from "@/lib/groups";
import {
  contactSchema,
  frequencySchema,
  groupNameSchema,
  idSchema,
  momentSchema,
  noteSchema,
  type ContactFormState,
  type ContactFormValues,
  type FrequencyFormState,
  type GroupFormState,
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

function readContactFields(formData: FormData): ContactFormValues {
  return {
    name: readText(formData, "name"),
    about: readText(formData, "about"),
    howWeMet: readText(formData, "howWeMet"),
    phone: readText(formData, "phone"),
    email: readText(formData, "email"),
    // Checked groups, then the names typed into "Новая группа"
    groupIds: formData.getAll("groupId").flatMap((value) => {
      const parsed = idSchema.safeParse(typeof value === "string" ? Number(value) : NaN);
      return parsed.success ? [parsed.data] : [];
    }),
    newGroupNames: formData
      .getAll("newGroup")
      .filter((value): value is string => typeof value === "string"),
  };
}

// The contact fields and the typed group names, checked together: the form shows all errors at once
function parseContactForm(values: ContactFormValues) {
  const contact = contactSchema.safeParse(values);
  const newGroupNames = z.array(groupNameSchema).safeParse(values.newGroupNames);
  if (contact.success && newGroupNames.success) {
    return { contact: contact.data, newGroupNames: newGroupNames.data };
  }

  return {
    errors: {
      ...(contact.success ? {} : z.flattenError(contact.error).fieldErrors),
      ...(newGroupNames.success
        ? {}
        : { newGroupNames: [newGroupNames.error.issues[0].message] }),
    },
  };
}

export async function createContact(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const values = readContactFields(formData);
  const parsed = parseContactForm(values);
  if (parsed.errors) {
    return { values, errors: parsed.errors };
  }

  const created = await db.transaction(async (tx) => {
    const [contact] = await tx
      .insert(contacts)
      .values(parsed.contact)
      .returning({ id: contacts.id });
    await setContactGroups(tx, contact.id, {
      groupIds: values.groupIds,
      newGroupNames: parsed.newGroupNames,
    });
    return contact;
  });

  revalidatePath("/");
  // New groups may have been made, and the number of contacts in groups changed
  revalidateGroups();
  redirect(`/contacts/${created.id}`);
}

export async function updateContact(
  contactId: number,
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const id = idSchema.parse(contactId);
  const values = readContactFields(formData);
  const parsed = parseContactForm(values);
  if (parsed.errors) {
    return { values, errors: parsed.errors };
  }

  const updated = await db.transaction(async (tx) => {
    const [contact] = await tx
      .update(contacts)
      .set(parsed.contact)
      .where(eq(contacts.id, id))
      .returning({ id: contacts.id });
    if (!contact) return null;

    await setContactGroups(tx, id, {
      groupIds: values.groupIds,
      newGroupNames: parsed.newGroupNames,
    });
    return contact;
  });

  if (!updated) {
    return { values, message: CONTACT_GONE };
  }

  revalidatePath("/");
  revalidatePath(`/contacts/${id}`);
  revalidateGroups();
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
  // The contact leaves its groups: the groups page shows how many contacts each one has
  revalidatePath("/groups");
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

// Name of a group is shown on the home page, in cards, in forms and on the groups page
function revalidateGroups() {
  revalidatePath("/", "layout");
}

export async function createGroup(
  _prevState: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const name = readText(formData, "name");
  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) {
    return { name, error: parsed.error.issues[0]?.message };
  }

  const result = await insertGroup(parsed.data);
  if ("error" in result) {
    return { name, error: result.error };
  }

  revalidateGroups();
  return {};
}

export async function renameGroup(
  groupId: number,
  _prevState: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const id = idSchema.parse(groupId);
  const name = readText(formData, "name");
  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) {
    return { name, error: parsed.error.issues[0]?.message };
  }

  const result = await updateGroup(id, parsed.data);
  if ("error" in result) {
    return { name, error: result.error };
  }

  revalidateGroups();
  // Back to the plain list: the row stops being a form
  redirect("/groups");
}

export async function deleteGroup(groupId: number) {
  const id = idSchema.parse(groupId);

  await removeGroup(id);

  revalidateGroups();
  redirect("/groups");
}
