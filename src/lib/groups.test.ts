import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { contacts } from "@/db/schema";
import { countContacts, getContact, listNotes } from "@/lib/data";
import {
  createGroup,
  deleteGroup,
  findGroup,
  listContactGroups,
  listGroups,
  renameGroup,
  setContactGroups,
} from "@/lib/groups";
import { addContact, addGroup, addNote, addToGroup } from "@/test/helpers";

describe("createGroup", () => {
  it("creates a group", async () => {
    const result = await createGroup("Теннис");

    expect(result).toEqual({ id: expect.any(Number) });
    expect(await listGroups()).toEqual([
      { id: (result as { id: number }).id, name: "Теннис", contactCount: 0 },
    ]);
  });

  it("refuses a name that differs only in case", async () => {
    await addGroup("Теннис");

    expect(await createGroup("теннис")).toEqual({ error: "Такая группа уже есть" });
    expect(await listGroups()).toHaveLength(1);
  });

  it("refuses a name that differs only in ё / е", async () => {
    await addGroup("Ёлка");

    expect(await createGroup("Елка")).toEqual({ error: "Такая группа уже есть" });
    expect(await listGroups()).toHaveLength(1);
  });
});

describe("listGroups", () => {
  it("lists groups alphabetically with the number of their contacts", async () => {
    const tennis = await addGroup("Теннис");
    const analysts = await addGroup("Аналитики");
    const family = await addGroup("Семья");
    const anna = await addContact("Анна");
    const boris = await addContact("Борис");
    await addToGroup(anna.id, tennis.id);
    await addToGroup(boris.id, tennis.id);
    await addToGroup(anna.id, family.id);

    expect(await listGroups()).toEqual([
      { id: analysts.id, name: "Аналитики", contactCount: 0 },
      { id: family.id, name: "Семья", contactCount: 1 },
      { id: tennis.id, name: "Теннис", contactCount: 2 },
    ]);
  });
});

describe("findGroup", () => {
  it("finds a group by id", async () => {
    const tennis = await addGroup("Теннис");

    expect(await findGroup(tennis.id)).toMatchObject({ id: tennis.id, name: "Теннис" });
  });

  it("finds nothing for an id that does not exist", async () => {
    expect(await findGroup(12345)).toBeUndefined();
  });
});

describe("renameGroup", () => {
  it("gives the group a new name", async () => {
    const analysts = await addGroup("Аналитики");

    expect(await renameGroup(analysts.id, "Работа")).toEqual({ id: analysts.id });
    expect((await findGroup(analysts.id))?.name).toBe("Работа");
  });

  it("lets a group change only the case of its name", async () => {
    const tennis = await addGroup("теннис");

    expect(await renameGroup(tennis.id, "Теннис")).toEqual({ id: tennis.id });
    expect((await findGroup(tennis.id))?.name).toBe("Теннис");
  });

  it("lets a group change ё to е and back", async () => {
    const tree = await addGroup("Елка");

    expect(await renameGroup(tree.id, "Ёлка")).toEqual({ id: tree.id });
    expect((await findGroup(tree.id))?.name).toBe("Ёлка");
  });

  it("refuses a name another group has", async () => {
    await addGroup("Теннис");
    const family = await addGroup("Семья");

    expect(await renameGroup(family.id, "теннис")).toEqual({ error: "Такая группа уже есть" });
    expect((await findGroup(family.id))?.name).toBe("Семья");
  });

  it("says so when the group was deleted", async () => {
    expect(await renameGroup(12345, "Работа")).toEqual({
      error: "Этой группы больше нет — возможно, её удалили",
    });
  });

  it("keeps the contacts of the group", async () => {
    const analysts = await addGroup("Аналитики");
    const anna = await addContact("Анна");
    await addToGroup(anna.id, analysts.id);

    await renameGroup(analysts.id, "Работа");

    expect(await listGroups()).toEqual([{ id: analysts.id, name: "Работа", contactCount: 1 }]);
  });
});

describe("deleteGroup", () => {
  it("removes the group but keeps its contacts, their notes and other groups", async () => {
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    const anna = await addContact("Анна");
    await addNote(anna.id, "Играли в субботу");
    await addToGroup(anna.id, tennis.id);
    await addToGroup(anna.id, family.id);

    await deleteGroup(tennis.id);

    expect(await findGroup(tennis.id)).toBeUndefined();
    expect(await listGroups()).toEqual([{ id: family.id, name: "Семья", contactCount: 1 }]);
    expect(await countContacts()).toBe(1);
    expect(await listNotes(anna.id)).toHaveLength(1);
  });

  it("does not fail when the group is already gone", async () => {
    const tennis = await addGroup("Теннис");

    await deleteGroup(tennis.id);
    await expect(deleteGroup(tennis.id)).resolves.toBeUndefined();
  });
});

describe("deleting a contact", () => {
  it("lowers the number of contacts in its groups", async () => {
    const tennis = await addGroup("Теннис");
    const anna = await addContact("Анна");
    const boris = await addContact("Борис");
    await addToGroup(anna.id, tennis.id);
    await addToGroup(boris.id, tennis.id);

    await db.delete(contacts).where(eq(contacts.id, anna.id));

    expect(await listGroups()).toEqual([{ id: tennis.id, name: "Теннис", contactCount: 1 }]);
  });
});

describe("setContactGroups", () => {
  function save(contactId: number, groupIds: number[], newGroupNames: string[] = []) {
    return db.transaction((tx) => setContactGroups(tx, contactId, { groupIds, newGroupNames }));
  }

  async function groupNamesOf(contactId: number) {
    return (await listContactGroups(contactId)).map((group) => group.name);
  }

  it("puts the contact into the checked groups", async () => {
    const family = await addGroup("Семья");
    const tennis = await addGroup("Теннис");
    await addGroup("Аналитики");
    const anna = await addContact("Анна");

    await save(anna.id, [family.id, tennis.id]);

    expect(await groupNamesOf(anna.id)).toEqual(["Семья", "Теннис"]);
  });

  it("replaces the groups on the next save", async () => {
    const family = await addGroup("Семья");
    const tennis = await addGroup("Теннис");
    const anna = await addContact("Анна");
    await save(anna.id, [family.id, tennis.id]);

    await save(anna.id, [family.id]);

    expect(await groupNamesOf(anna.id)).toEqual(["Семья"]);
  });

  it("takes the contact out of all groups when nothing is checked", async () => {
    const family = await addGroup("Семья");
    const anna = await addContact("Анна");
    await save(anna.id, [family.id]);

    await save(anna.id, []);

    expect(await groupNamesOf(anna.id)).toEqual([]);
  });

  it("leaves the other contacts of a group alone", async () => {
    const family = await addGroup("Семья");
    const anna = await addContact("Анна");
    const boris = await addContact("Борис");
    await addToGroup(boris.id, family.id);

    await save(anna.id, [family.id]);
    await save(anna.id, []);

    expect(await groupNamesOf(boris.id)).toEqual(["Семья"]);
  });

  it("creates the new groups", async () => {
    const anna = await addContact("Анна");

    await save(anna.id, [], ["Аналитики", "Теннис"]);

    expect(await groupNamesOf(anna.id)).toEqual(["Аналитики", "Теннис"]);
    expect((await listGroups()).map((group) => group.name)).toEqual(["Аналитики", "Теннис"]);
  });

  it("puts a new name into the group that already has it, whatever the case", async () => {
    await addGroup("Теннис");
    const anna = await addContact("Анна");

    await save(anna.id, [], ["теннис"]);

    expect(await groupNamesOf(anna.id)).toEqual(["Теннис"]);
    expect(await listGroups()).toHaveLength(1);
  });

  it("puts a new name into the group that has it with ё instead of е", async () => {
    await addGroup("Ёлка");
    const anna = await addContact("Анна");

    await save(anna.id, [], ["елка"]);

    expect(await groupNamesOf(anna.id)).toEqual(["Ёлка"]);
    expect(await listGroups()).toHaveLength(1);
  });

  it("makes one group of two new names that are the same", async () => {
    const anna = await addContact("Анна");

    await save(anna.id, [], ["Теннис", "теннис"]);

    expect(await groupNamesOf(anna.id)).toEqual(["Теннис"]);
  });

  it("does not add a group twice when it is both checked and typed", async () => {
    const tennis = await addGroup("Теннис");
    const anna = await addContact("Анна");

    await save(anna.id, [tennis.id], ["Теннис"]);

    expect(await groupNamesOf(anna.id)).toEqual(["Теннис"]);
  });

  it("drops a group that was deleted meanwhile and saves the rest", async () => {
    const family = await addGroup("Семья");
    const tennis = await addGroup("Теннис");
    const anna = await addContact("Анна");
    await deleteGroup(tennis.id);

    await save(anna.id, [family.id, tennis.id]);

    expect(await groupNamesOf(anna.id)).toEqual(["Семья"]);
  });

  it("does not touch the frequency, the last contact or the notes", async () => {
    const family = await addGroup("Семья");
    const lastContactedAt = new Date("2026-09-01T10:00:00.000Z");
    const anna = await addContact("Анна", { contactFrequency: "month", lastContactedAt });
    await addNote(anna.id, "Играли в субботу");

    await save(anna.id, [family.id]);

    const contact = await getContact(anna.id);
    expect(contact?.contactFrequency).toBe("month");
    expect(contact?.lastContactedAt).toEqual(lastContactedAt);
    expect(await listNotes(anna.id)).toHaveLength(1);
  });
});

describe("listContactGroups", () => {
  it("lists the groups of a contact alphabetically", async () => {
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    await addGroup("Аналитики");
    const anna = await addContact("Анна");
    await addToGroup(anna.id, tennis.id);
    await addToGroup(anna.id, family.id);

    expect(await listContactGroups(anna.id)).toEqual([
      { id: family.id, name: "Семья" },
      { id: tennis.id, name: "Теннис" },
    ]);
  });

  it("is empty for a contact without groups", async () => {
    const boris = await addContact("Борис");

    expect(await listContactGroups(boris.id)).toEqual([]);
  });
});
