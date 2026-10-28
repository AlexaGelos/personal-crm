// Server actions of "Пора связаться" on the test database. Only the Next.js page refresh
// and redirect are stubbed: outside Next.js they have nothing to work on
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import {
  createContact,
  deleteContact,
  markContacted,
  setContactFrequency,
  undoContacted,
  updateContact,
} from "@/app/actions";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { getContact, listNotes, listOverdueContacts } from "@/lib/data";
import { addContact } from "@/test/helpers";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const CONTACT_GONE = "Этого контакта больше нет — возможно, его удалили";

function form(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

const contactForm = (name: string) =>
  form({ name, about: "Школьный друг", howWeMet: "", phone: "", email: "" });

async function deleteFromDatabase(contactId: number) {
  await db.delete(contacts).where(eq(contacts.id, contactId));
}

// Weekly, added a month ago and never contacted: overdue
function addOverdue(name: string) {
  return addContact(name, {
    contactFrequency: "week",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  });
}

describe("createContact", () => {
  it("adds a contact without a frequency and without «Связались»", async () => {
    await createContact({}, contactForm("Борис"));

    const [created] = await db.select().from(contacts);
    expect(created.name).toBe("Борис");
    expect(created.contactFrequency).toBeNull();
    expect(created.lastContactedAt).toBeNull();
  });
});

describe("updateContact", () => {
  it("keeps the frequency and «Связались»", async () => {
    const lastContactedAt = new Date("2026-09-20T10:00:00.000Z");
    const boris = await addContact("Борис", { contactFrequency: "month", lastContactedAt });

    await updateContact(boris.id, {}, contactForm("Борис Петров"));

    const contact = await getContact(boris.id);
    expect(contact?.name).toBe("Борис Петров");
    expect(contact?.contactFrequency).toBe("month");
    expect(contact?.lastContactedAt).toEqual(lastContactedAt);
  });
});

describe("setContactFrequency", () => {
  it("saves the chosen frequency", async () => {
    const boris = await addContact("Борис");

    expect(await setContactFrequency(boris.id, {}, form({ frequency: "month" }))).toEqual({});

    expect((await getContact(boris.id))?.contactFrequency).toBe("month");
  });

  it("clears the frequency with «Не задано»: no due date, not in «Пора связаться»", async () => {
    const boris = await addOverdue("Борис");

    await setContactFrequency(boris.id, {}, form({ frequency: "none" }));

    const contact = await getContact(boris.id);
    expect(contact?.contactFrequency).toBeNull();
    expect(contact?.dueDate).toBeNull();
    expect(await listOverdueContacts()).toEqual([]);
  });

  it("says so when the contact was deleted in another tab", async () => {
    const boris = await addContact("Борис");
    await deleteFromDatabase(boris.id);

    expect(await setContactFrequency(boris.id, {}, form({ frequency: "month" }))).toEqual({
      error: CONTACT_GONE,
    });
  });
});

describe("markContacted", () => {
  it("remembers the moment of the press and adds no note", async () => {
    const boris = await addContact("Борис");
    const before = Date.now();

    const result = await markContacted(boris.id);

    if (!("mark" in result)) throw new Error(result.error);
    expect(result.mark).toMatchObject({ contactId: boris.id, name: "Борис", previous: null });
    const contact = await getContact(boris.id);
    expect(contact?.lastContactedAt?.toISOString()).toBe(result.mark.markedAt);
    expect(contact?.lastContactedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(await listNotes(boris.id)).toEqual([]);
  });

  it("takes the contact out of «Пора связаться», the total goes down", async () => {
    const names = ["Анна", "Борис", "Вера", "Глеб", "Дарья", "Егор", "Жанна"];
    const added = [];
    for (const name of names) added.push(await addOverdue(name));
    expect((await listOverdueContacts())[0].total).toBe(7);

    await markContacted(added[1].id);

    const rows = await listOverdueContacts();
    expect(rows.map((row) => row.name)).not.toContain("Борис");
    expect(rows[0].total).toBe(6);
  });

  it("says so when the contact was deleted in another tab", async () => {
    const boris = await addContact("Борис");
    await deleteFromDatabase(boris.id);

    expect(await markContacted(boris.id)).toEqual({ error: CONTACT_GONE });
  });
});

describe("undoContacted", () => {
  it("brings back the previous «Связались»", async () => {
    const previous = new Date("2026-09-20T10:00:00.000Z");
    const boris = await addOverdue("Борис");
    await db.update(contacts).set({ lastContactedAt: previous }).where(eq(contacts.id, boris.id));
    const overdueBefore = await listOverdueContacts();

    const result = await markContacted(boris.id);
    if (!("mark" in result)) throw new Error(result.error);
    expect(result.mark.previous).toBe(previous.toISOString());

    expect(await undoContacted(boris.id, result.mark.previous, result.mark.markedAt)).toEqual({});

    expect((await getContact(boris.id))?.lastContactedAt).toEqual(previous);
    expect(await listOverdueContacts()).toEqual(overdueBefore);
  });

  it("leaves no «Связались» when there was none before", async () => {
    const boris = await addContact("Борис");
    const result = await markContacted(boris.id);
    if (!("mark" in result)) throw new Error(result.error);

    await undoContacted(boris.id, result.mark.previous, result.mark.markedAt);

    expect((await getContact(boris.id))?.lastContactedAt).toBeNull();
  });

  it("can't undo once the contact was deleted in another tab", async () => {
    const boris = await addContact("Борис");
    const result = await markContacted(boris.id);
    if (!("mark" in result)) throw new Error(result.error);
    await deleteFromDatabase(boris.id);

    expect(await undoContacted(boris.id, result.mark.previous, result.mark.markedAt)).toEqual({
      error: "Отменить уже не получится",
    });
  });
});

describe("deleteContact", () => {
  it("takes an overdue contact out of «Пора связаться»", async () => {
    const boris = await addOverdue("Борис");
    await addOverdue("Вера");

    await deleteContact(boris.id);

    expect((await listOverdueContacts()).map((row) => row.name)).toEqual(["Вера"]);
  });
});
