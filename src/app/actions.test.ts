// Server actions of "Пора связаться" on the test database. Only the Next.js page refresh
// and redirect are stubbed: outside Next.js they have nothing to work on
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as actions from "@/app/actions";
import {
  addNote,
  createContact,
  createGroup,
  deleteContact,
  deleteGroup,
  markContacted,
  renameGroup,
  setContactFrequency,
  undoContacted,
  updateContact,
} from "@/app/actions";
import { db } from "@/db";
import { contactGroups, contacts, groups, notes } from "@/db/schema";
import { getContact, listNotes, listOverdueContacts } from "@/lib/data";
import { listContactGroups, listGroups } from "@/lib/groups";
import {
  addContact,
  addGroup,
  addNote as seedNote,
  addToGroup,
  addUser,
  TEST_USER_ID,
} from "@/test/helpers";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
// Who is logged in is decided by the test; the default is the user every test has
const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/session", () => ({
  requireUserId: async () => {
    if (session.userId === null) throw new Error("REDIRECT /login");
    return session.userId;
  },
}));

beforeEach(() => {
  session.userId = TEST_USER_ID;
});

const CONTACT_GONE = "Этого контакта больше нет — возможно, его удалили";
const GROUP_GONE = "Этой группы больше нет — возможно, её удалили";

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
  return addContact(TEST_USER_ID, name, {
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
    const boris = await addContact(TEST_USER_ID, "Борис", {
      contactFrequency: "month",
      lastContactedAt,
    });

    await updateContact(boris.id, {}, contactForm("Борис Петров"));

    const contact = await getContact(TEST_USER_ID, boris.id);
    expect(contact?.name).toBe("Борис Петров");
    expect(contact?.contactFrequency).toBe("month");
    expect(contact?.lastContactedAt).toEqual(lastContactedAt);
  });
});

describe("setContactFrequency", () => {
  it("saves the chosen frequency", async () => {
    const boris = await addContact(TEST_USER_ID, "Борис");

    expect(await setContactFrequency(boris.id, {}, form({ frequency: "month" }))).toEqual({});

    expect((await getContact(TEST_USER_ID, boris.id))?.contactFrequency).toBe("month");
  });

  it("clears the frequency with «Не задано»: no due date, not in «Пора связаться»", async () => {
    const boris = await addOverdue("Борис");

    await setContactFrequency(boris.id, {}, form({ frequency: "none" }));

    const contact = await getContact(TEST_USER_ID, boris.id);
    expect(contact?.contactFrequency).toBeNull();
    expect(contact?.dueDate).toBeNull();
    expect(await listOverdueContacts(TEST_USER_ID)).toEqual([]);
  });

  it("says so when the contact was deleted in another tab", async () => {
    const boris = await addContact(TEST_USER_ID, "Борис");
    await deleteFromDatabase(boris.id);

    expect(await setContactFrequency(boris.id, {}, form({ frequency: "month" }))).toEqual({
      error: CONTACT_GONE,
    });
  });
});

describe("markContacted", () => {
  it("remembers the moment of the press and adds no note", async () => {
    const boris = await addContact(TEST_USER_ID, "Борис");
    const before = Date.now();

    const result = await markContacted(boris.id);

    if (!("mark" in result)) throw new Error(result.error);
    expect(result.mark).toMatchObject({ contactId: boris.id, name: "Борис", previous: null });
    const contact = await getContact(TEST_USER_ID, boris.id);
    expect(contact?.lastContactedAt?.toISOString()).toBe(result.mark.markedAt);
    expect(contact?.lastContactedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(await listNotes(TEST_USER_ID, boris.id)).toEqual([]);
  });

  it("takes the contact out of «Пора связаться», the total goes down", async () => {
    const names = ["Анна", "Борис", "Вера", "Глеб", "Дарья", "Егор", "Жанна"];
    const added = [];
    for (const name of names) added.push(await addOverdue(name));
    expect((await listOverdueContacts(TEST_USER_ID))[0].total).toBe(7);

    await markContacted(added[1].id);

    const rows = await listOverdueContacts(TEST_USER_ID);
    expect(rows.map((row) => row.name)).not.toContain("Борис");
    expect(rows[0].total).toBe(6);
  });

  it("says so when the contact was deleted in another tab", async () => {
    const boris = await addContact(TEST_USER_ID, "Борис");
    await deleteFromDatabase(boris.id);

    expect(await markContacted(boris.id)).toEqual({ error: CONTACT_GONE });
  });
});

describe("undoContacted", () => {
  it("brings back the previous «Связались»", async () => {
    const previous = new Date("2026-09-20T10:00:00.000Z");
    const boris = await addOverdue("Борис");
    await db.update(contacts).set({ lastContactedAt: previous }).where(eq(contacts.id, boris.id));
    const overdueBefore = await listOverdueContacts(TEST_USER_ID);

    const result = await markContacted(boris.id);
    if (!("mark" in result)) throw new Error(result.error);
    expect(result.mark.previous).toBe(previous.toISOString());

    expect(await undoContacted(boris.id, result.mark.previous, result.mark.markedAt)).toEqual({});

    expect((await getContact(TEST_USER_ID, boris.id))?.lastContactedAt).toEqual(previous);
    expect(await listOverdueContacts(TEST_USER_ID)).toEqual(overdueBefore);
  });

  it("leaves no «Связались» when there was none before", async () => {
    const boris = await addContact(TEST_USER_ID, "Борис");
    const result = await markContacted(boris.id);
    if (!("mark" in result)) throw new Error(result.error);

    await undoContacted(boris.id, result.mark.previous, result.mark.markedAt);

    expect((await getContact(TEST_USER_ID, boris.id))?.lastContactedAt).toBeNull();
  });

  it("can't undo once the contact was deleted in another tab", async () => {
    const boris = await addContact(TEST_USER_ID, "Борис");
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

    expect((await listOverdueContacts(TEST_USER_ID)).map((row) => row.name)).toEqual(["Вера"]);
  });
});

// Everything the actions can change
async function snapshot() {
  return {
    contacts: await db.select().from(contacts).orderBy(contacts.id),
    notes: await db.select().from(notes).orderBy(notes.id),
    groups: await db.select().from(groups).orderBy(groups.id),
    links: await db.select().from(contactGroups).orderBy(contactGroups.contactId),
  };
}

describe("every action without a login", () => {
  // One entry per exported action; the test below fails when a new action is not in the table
  const calls: Record<string, () => Promise<unknown>> = {
    createContact: () => createContact({}, contactForm("Борис")),
    updateContact: () => updateContact(1, {}, contactForm("Борис Петров")),
    deleteContact: () => deleteContact(1),
    addNote: () => addNote(1, {}, form({ body: "Созвонились" })),
    setContactFrequency: () => setContactFrequency(1, {}, form({ frequency: "month" })),
    markContacted: () => markContacted(1),
    undoContacted: () => undoContacted(1, null, "2026-10-01T10:00:00.000Z"),
    createGroup: () => createGroup({}, form({ name: "Теннис" })),
    renameGroup: () => renameGroup(1, {}, form({ name: "Работа" })),
    deleteGroup: () => deleteGroup(1),
  };

  it("has every exported action in the table", () => {
    expect(Object.keys(calls).sort()).toEqual(Object.keys(actions).sort());
  });

  it.each(Object.keys(calls))("%s sends to the login page and changes nothing", async (name) => {
    const boris = await addContact(TEST_USER_ID, "Борис", { contactFrequency: "week" });
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    await addToGroup(boris.id, tennis.id);
    await seedNote(boris.id, "Обсудили отпуск");
    const before = await snapshot();
    session.userId = null;

    await expect(calls[name]()).rejects.toThrow("REDIRECT /login");

    expect(await snapshot()).toEqual(before);
  });
});

describe("the owner of what an action creates", () => {
  it("is the user who made the request: a new contact", async () => {
    await createContact({}, contactForm("Борис"));

    const [created] = await db.select().from(contacts);
    expect(created.userId).toBe(TEST_USER_ID);
  });

  it("is the user who made the request: a new group on the groups page", async () => {
    await createGroup({}, form({ name: "Теннис" }));

    const [created] = await db.select().from(groups);
    expect(created.userId).toBe(TEST_USER_ID);
  });

  it("is the user who made the request: a new group typed into the contact form", async () => {
    const formData = contactForm("Анна");
    formData.append("newGroup", "Теннис");

    await createContact({}, formData);

    const [group] = await db.select().from(groups);
    const [anna] = await db.select().from(contacts);
    expect(group.userId).toBe(TEST_USER_ID);
    expect(anna.userId).toBe(TEST_USER_ID);
    expect(await listContactGroups(TEST_USER_ID, anna.id)).toHaveLength(1);
  });
});

// A is somebody else; the session belongs to the test user, B
describe("actions on the data of another user", () => {
  async function ownerA() {
    const a = await addUser("a@example.com");
    const anna = await addContact(a.id, "Анна", {
      contactFrequency: "month",
      lastContactedAt: new Date("2026-09-20T10:00:00.000Z"),
    });
    const family = await addGroup(a.id, "Семья");
    await addToGroup(anna.id, family.id);
    await seedNote(anna.id, "Обсудили отпуск");
    return { a: a.id, anna, family };
  }

  it("does not change a contact of another user, and says it is gone", async () => {
    const { anna } = await ownerA();
    const before = await snapshot();

    const result = await updateContact(anna.id, {}, contactForm("Взломанная"));

    expect(result.message).toBe(CONTACT_GONE);
    expect(await snapshot()).toEqual(before);
  });

  it("does not delete a contact of another user or its notes", async () => {
    const { anna } = await ownerA();
    const before = await snapshot();

    await deleteContact(anna.id);

    expect(await snapshot()).toEqual(before);
  });

  it("does not add a note to a contact of another user", async () => {
    const { anna } = await ownerA();
    const before = await snapshot();

    expect(await addNote(anna.id, {}, form({ body: "Чужая заметка" }))).toEqual({
      body: "Чужая заметка",
      error: CONTACT_GONE,
    });

    expect(await snapshot()).toEqual(before);
  });

  it("does not change the frequency of a contact of another user", async () => {
    const { anna } = await ownerA();
    const before = await snapshot();

    expect(await setContactFrequency(anna.id, {}, form({ frequency: "week" }))).toEqual({
      error: CONTACT_GONE,
    });

    expect(await snapshot()).toEqual(before);
  });

  it("does not press «Связались» or undo it for a contact of another user", async () => {
    const { anna } = await ownerA();
    const before = await snapshot();

    expect(await markContacted(anna.id)).toEqual({ error: CONTACT_GONE });
    expect(
      await undoContacted(anna.id, null, new Date("2026-09-20T10:00:00.000Z").toISOString()),
    ).toEqual({ error: "Отменить уже не получится" });

    expect(await snapshot()).toEqual(before);
  });

  it("does not rename a group of another user, and says it is gone", async () => {
    const { family } = await ownerA();
    const before = await snapshot();

    expect(await renameGroup(family.id, {}, form({ name: "Мои" }))).toEqual({
      name: "Мои",
      error: GROUP_GONE,
    });

    expect(await snapshot()).toEqual(before);
  });

  it("does not delete a group of another user or its contacts", async () => {
    const { family } = await ownerA();
    const before = await snapshot();

    await deleteGroup(family.id);

    expect(await snapshot()).toEqual(before);
  });

  it("saves a contact without a group number that belongs to another user", async () => {
    const { a, family } = await ownerA();
    const boris = await addContact(TEST_USER_ID, "Борис");
    const formData = contactForm("Борис");
    formData.append("groupId", String(family.id));

    await updateContact(boris.id, {}, formData);

    expect(await listContactGroups(TEST_USER_ID, boris.id)).toEqual([]);
    expect(await listGroups(a)).toEqual([{ id: family.id, name: "Семья", contactCount: 1 }]);
  });

  it("makes a new contact without a group number that belongs to another user", async () => {
    const { a, family } = await ownerA();
    const formData = contactForm("Борис");
    formData.append("groupId", String(family.id));

    await createContact({}, formData);

    const boris = (await db.select().from(contacts)).find((contact) => contact.name === "Борис");
    expect(await listContactGroups(TEST_USER_ID, boris!.id)).toEqual([]);
    expect(await listGroups(a)).toEqual([{ id: family.id, name: "Семья", contactCount: 1 }]);
  });

  it("makes its own group for a new name that a group of another user already has", async () => {
    const { a, family } = await ownerA();
    const boris = await addContact(TEST_USER_ID, "Борис");
    const formData = contactForm("Борис");
    formData.append("newGroup", "семья");

    await updateContact(boris.id, {}, formData);

    const [own] = await listContactGroups(TEST_USER_ID, boris.id);
    expect(own.name).toBe("семья");
    expect(own.id).not.toBe(family.id);
    expect(await listGroups(a)).toEqual([{ id: family.id, name: "Семья", contactCount: 1 }]);
  });

  it("lets a user make a group with the name that a group of another user has", async () => {
    const { family } = await ownerA();

    expect(await createGroup({}, form({ name: "Семья" }))).toEqual({});

    const own = await listGroups(TEST_USER_ID);
    expect(own.map((group) => group.name)).toEqual(["Семья"]);
    expect(own[0].id).not.toBe(family.id);
  });
});
