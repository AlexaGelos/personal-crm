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
import { addContact, addGroup, addNote, addToGroup, addUser, TEST_USER_ID } from "@/test/helpers";

describe("createGroup", () => {
  it("creates a group", async () => {
    const result = await createGroup(TEST_USER_ID, "Теннис");

    expect(result).toEqual({ id: expect.any(Number) });
    expect(await listGroups(TEST_USER_ID)).toEqual([
      { id: (result as { id: number }).id, name: "Теннис", contactCount: 0 },
    ]);
  });

  it("refuses a name that differs only in case", async () => {
    await addGroup(TEST_USER_ID, "Теннис");

    expect(await createGroup(TEST_USER_ID, "теннис")).toEqual({ error: "Такая группа уже есть" });
    expect(await listGroups(TEST_USER_ID)).toHaveLength(1);
  });

  it("refuses a name that differs only in ё / е", async () => {
    await addGroup(TEST_USER_ID, "Ёлка");

    expect(await createGroup(TEST_USER_ID, "Елка")).toEqual({ error: "Такая группа уже есть" });
    expect(await listGroups(TEST_USER_ID)).toHaveLength(1);
  });
});

describe("listGroups", () => {
  it("lists groups alphabetically with the number of their contacts", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const analysts = await addGroup(TEST_USER_ID, "Аналитики");
    const family = await addGroup(TEST_USER_ID, "Семья");
    const anna = await addContact(TEST_USER_ID, "Анна");
    const boris = await addContact(TEST_USER_ID, "Борис");
    await addToGroup(anna.id, tennis.id);
    await addToGroup(boris.id, tennis.id);
    await addToGroup(anna.id, family.id);

    expect(await listGroups(TEST_USER_ID)).toEqual([
      { id: analysts.id, name: "Аналитики", contactCount: 0 },
      { id: family.id, name: "Семья", contactCount: 1 },
      { id: tennis.id, name: "Теннис", contactCount: 2 },
    ]);
  });
});

describe("findGroup", () => {
  it("finds a group by id", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");

    expect(await findGroup(TEST_USER_ID, tennis.id)).toMatchObject({
      id: tennis.id,
      name: "Теннис",
    });
  });

  it("finds nothing for an id that does not exist", async () => {
    expect(await findGroup(TEST_USER_ID, 12345)).toBeUndefined();
  });
});

describe("renameGroup", () => {
  it("gives the group a new name", async () => {
    const analysts = await addGroup(TEST_USER_ID, "Аналитики");

    expect(await renameGroup(TEST_USER_ID, analysts.id, "Работа")).toEqual({ id: analysts.id });
    expect((await findGroup(TEST_USER_ID, analysts.id))?.name).toBe("Работа");
  });

  it("lets a group change only the case of its name", async () => {
    const tennis = await addGroup(TEST_USER_ID, "теннис");

    expect(await renameGroup(TEST_USER_ID, tennis.id, "Теннис")).toEqual({ id: tennis.id });
    expect((await findGroup(TEST_USER_ID, tennis.id))?.name).toBe("Теннис");
  });

  it("lets a group change ё to е and back", async () => {
    const tree = await addGroup(TEST_USER_ID, "Елка");

    expect(await renameGroup(TEST_USER_ID, tree.id, "Ёлка")).toEqual({ id: tree.id });
    expect((await findGroup(TEST_USER_ID, tree.id))?.name).toBe("Ёлка");
  });

  it("refuses a name another group has", async () => {
    await addGroup(TEST_USER_ID, "Теннис");
    const family = await addGroup(TEST_USER_ID, "Семья");

    expect(await renameGroup(TEST_USER_ID, family.id, "теннис")).toEqual({
      error: "Такая группа уже есть",
    });
    expect((await findGroup(TEST_USER_ID, family.id))?.name).toBe("Семья");
  });

  it("says so when the group was deleted", async () => {
    expect(await renameGroup(TEST_USER_ID, 12345, "Работа")).toEqual({
      error: "Этой группы больше нет — возможно, её удалили",
    });
  });

  it("keeps the contacts of the group", async () => {
    const analysts = await addGroup(TEST_USER_ID, "Аналитики");
    const anna = await addContact(TEST_USER_ID, "Анна");
    await addToGroup(anna.id, analysts.id);

    await renameGroup(TEST_USER_ID, analysts.id, "Работа");

    expect(await listGroups(TEST_USER_ID)).toEqual([
      { id: analysts.id, name: "Работа", contactCount: 1 },
    ]);
  });
});

describe("deleteGroup", () => {
  it("removes the group but keeps its contacts, their notes and other groups", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const family = await addGroup(TEST_USER_ID, "Семья");
    const anna = await addContact(TEST_USER_ID, "Анна");
    await addNote(anna.id, "Играли в субботу");
    await addToGroup(anna.id, tennis.id);
    await addToGroup(anna.id, family.id);

    await deleteGroup(TEST_USER_ID, tennis.id);

    expect(await findGroup(TEST_USER_ID, tennis.id)).toBeUndefined();
    expect(await listGroups(TEST_USER_ID)).toEqual([
      { id: family.id, name: "Семья", contactCount: 1 },
    ]);
    expect(await countContacts(TEST_USER_ID)).toBe(1);
    expect(await listNotes(TEST_USER_ID, anna.id)).toHaveLength(1);
  });

  it("does not fail when the group is already gone", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");

    await deleteGroup(TEST_USER_ID, tennis.id);
    await expect(deleteGroup(TEST_USER_ID, tennis.id)).resolves.toBeUndefined();
  });
});

describe("deleting a contact", () => {
  it("lowers the number of contacts in its groups", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const anna = await addContact(TEST_USER_ID, "Анна");
    const boris = await addContact(TEST_USER_ID, "Борис");
    await addToGroup(anna.id, tennis.id);
    await addToGroup(boris.id, tennis.id);

    await db.delete(contacts).where(eq(contacts.id, anna.id));

    expect(await listGroups(TEST_USER_ID)).toEqual([
      { id: tennis.id, name: "Теннис", contactCount: 1 },
    ]);
  });
});

describe("setContactGroups", () => {
  function save(contactId: number, groupIds: number[], newGroupNames: string[] = []) {
    return db.transaction((tx) =>
      setContactGroups(tx, TEST_USER_ID, contactId, { groupIds, newGroupNames }),
    );
  }

  async function groupNamesOf(contactId: number) {
    return (await listContactGroups(TEST_USER_ID, contactId)).map((group) => group.name);
  }

  it("puts the contact into the checked groups", async () => {
    const family = await addGroup(TEST_USER_ID, "Семья");
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    await addGroup(TEST_USER_ID, "Аналитики");
    const anna = await addContact(TEST_USER_ID, "Анна");

    await save(anna.id, [family.id, tennis.id]);

    expect(await groupNamesOf(anna.id)).toEqual(["Семья", "Теннис"]);
  });

  it("replaces the groups on the next save", async () => {
    const family = await addGroup(TEST_USER_ID, "Семья");
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const anna = await addContact(TEST_USER_ID, "Анна");
    await save(anna.id, [family.id, tennis.id]);

    await save(anna.id, [family.id]);

    expect(await groupNamesOf(anna.id)).toEqual(["Семья"]);
  });

  it("takes the contact out of all groups when nothing is checked", async () => {
    const family = await addGroup(TEST_USER_ID, "Семья");
    const anna = await addContact(TEST_USER_ID, "Анна");
    await save(anna.id, [family.id]);

    await save(anna.id, []);

    expect(await groupNamesOf(anna.id)).toEqual([]);
  });

  it("leaves the other contacts of a group alone", async () => {
    const family = await addGroup(TEST_USER_ID, "Семья");
    const anna = await addContact(TEST_USER_ID, "Анна");
    const boris = await addContact(TEST_USER_ID, "Борис");
    await addToGroup(boris.id, family.id);

    await save(anna.id, [family.id]);
    await save(anna.id, []);

    expect(await groupNamesOf(boris.id)).toEqual(["Семья"]);
  });

  it("creates the new groups", async () => {
    const anna = await addContact(TEST_USER_ID, "Анна");

    await save(anna.id, [], ["Аналитики", "Теннис"]);

    expect(await groupNamesOf(anna.id)).toEqual(["Аналитики", "Теннис"]);
    expect((await listGroups(TEST_USER_ID)).map((group) => group.name)).toEqual([
      "Аналитики",
      "Теннис",
    ]);
  });

  it("puts a new name into the group that already has it, whatever the case", async () => {
    await addGroup(TEST_USER_ID, "Теннис");
    const anna = await addContact(TEST_USER_ID, "Анна");

    await save(anna.id, [], ["теннис"]);

    expect(await groupNamesOf(anna.id)).toEqual(["Теннис"]);
    expect(await listGroups(TEST_USER_ID)).toHaveLength(1);
  });

  it("puts a new name into the group that has it with ё instead of е", async () => {
    await addGroup(TEST_USER_ID, "Ёлка");
    const anna = await addContact(TEST_USER_ID, "Анна");

    await save(anna.id, [], ["елка"]);

    expect(await groupNamesOf(anna.id)).toEqual(["Ёлка"]);
    expect(await listGroups(TEST_USER_ID)).toHaveLength(1);
  });

  it("makes one group of two new names that are the same", async () => {
    const anna = await addContact(TEST_USER_ID, "Анна");

    await save(anna.id, [], ["Теннис", "теннис"]);

    expect(await groupNamesOf(anna.id)).toEqual(["Теннис"]);
  });

  it("does not add a group twice when it is both checked and typed", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const anna = await addContact(TEST_USER_ID, "Анна");

    await save(anna.id, [tennis.id], ["Теннис"]);

    expect(await groupNamesOf(anna.id)).toEqual(["Теннис"]);
  });

  it("drops a group that was deleted meanwhile and saves the rest", async () => {
    const family = await addGroup(TEST_USER_ID, "Семья");
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const anna = await addContact(TEST_USER_ID, "Анна");
    await deleteGroup(TEST_USER_ID, tennis.id);

    await save(anna.id, [family.id, tennis.id]);

    expect(await groupNamesOf(anna.id)).toEqual(["Семья"]);
  });

  it("does not touch the frequency, the last contact or the notes", async () => {
    const family = await addGroup(TEST_USER_ID, "Семья");
    const lastContactedAt = new Date("2026-09-01T10:00:00.000Z");
    const anna = await addContact(TEST_USER_ID, "Анна", {
      contactFrequency: "month",
      lastContactedAt,
    });
    await addNote(anna.id, "Играли в субботу");

    await save(anna.id, [family.id]);

    const contact = await getContact(TEST_USER_ID, anna.id);
    expect(contact?.contactFrequency).toBe("month");
    expect(contact?.lastContactedAt).toEqual(lastContactedAt);
    expect(await listNotes(TEST_USER_ID, anna.id)).toHaveLength(1);
  });
});

describe("listContactGroups", () => {
  it("lists the groups of a contact alphabetically", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const family = await addGroup(TEST_USER_ID, "Семья");
    await addGroup(TEST_USER_ID, "Аналитики");
    const anna = await addContact(TEST_USER_ID, "Анна");
    await addToGroup(anna.id, tennis.id);
    await addToGroup(anna.id, family.id);

    expect(await listContactGroups(TEST_USER_ID, anna.id)).toEqual([
      { id: family.id, name: "Семья" },
      { id: tennis.id, name: "Теннис" },
    ]);
  });

  it("is empty for a contact without groups", async () => {
    const boris = await addContact(TEST_USER_ID, "Борис");

    expect(await listContactGroups(TEST_USER_ID, boris.id)).toEqual([]);
  });
});

// Two users: B must never get anything of A in any answer, and never change it
describe("groups of another user", () => {
  async function twoUsers() {
    const a = await addUser("a@example.com");
    const b = await addUser("b@example.com");
    return { a: a.id, b: b.id };
  }

  it("lists only the groups of the user, counting only their contacts", async () => {
    const { a, b } = await twoUsers();
    await addGroup(a, "Теннис");
    const family = await addGroup(b, "Семья");
    const boris = await addContact(b, "Борис");
    await addToGroup(boris.id, family.id);

    expect(await listGroups(b)).toEqual([{ id: family.id, name: "Семья", contactCount: 1 }]);
  });

  it("finds no group of another user", async () => {
    const { a, b } = await twoUsers();
    const tennis = await addGroup(a, "Теннис");

    expect(await findGroup(b, tennis.id)).toBeUndefined();
    expect(await findGroup(a, tennis.id)).toMatchObject({ id: tennis.id });
  });

  it("gives no groups of another user's contact", async () => {
    const { a, b } = await twoUsers();
    const tennis = await addGroup(a, "Теннис");
    const anna = await addContact(a, "Анна");
    await addToGroup(anna.id, tennis.id);

    expect(await listContactGroups(b, anna.id)).toEqual([]);
    expect(await listContactGroups(a, anna.id)).toHaveLength(1);
  });

  it("lets two users have a group with the same name", async () => {
    const { a, b } = await twoUsers();
    await addGroup(a, "Друзья");

    const result = await createGroup(b, "друзья");

    expect(result).toEqual({ id: expect.any(Number) });
    expect(await listGroups(a)).toHaveLength(1);
    expect(await listGroups(b)).toHaveLength(1);
  });

  it("lets a user rename a group to the name another user's group has", async () => {
    const { a, b } = await twoUsers();
    const theirs = await addGroup(a, "Друзья");
    const mine = await addGroup(b, "Семья");

    expect(await renameGroup(b, mine.id, "Друзья")).toEqual({ id: mine.id });

    expect((await findGroup(b, mine.id))?.name).toBe("Друзья");
    expect((await findGroup(a, theirs.id))?.name).toBe("Друзья");
  });

  it("does not rename a group of another user", async () => {
    const { a, b } = await twoUsers();
    const theirs = await addGroup(a, "Друзья");

    expect(await renameGroup(b, theirs.id, "Мои")).toEqual({
      error: "Этой группы больше нет — возможно, её удалили",
    });

    expect((await findGroup(a, theirs.id))?.name).toBe("Друзья");
  });

  it("does not delete a group of another user", async () => {
    const { a, b } = await twoUsers();
    const theirs = await addGroup(a, "Друзья");
    const anna = await addContact(a, "Анна");
    await addToGroup(anna.id, theirs.id);

    await deleteGroup(b, theirs.id);

    expect(await listGroups(a)).toEqual([{ id: theirs.id, name: "Друзья", contactCount: 1 }]);
  });

  describe("setContactGroups", () => {
    function save(
      userId: string,
      contactId: number,
      groupIds: number[],
      newGroupNames: string[] = [],
    ) {
      return db.transaction((tx) =>
        setContactGroups(tx, userId, contactId, { groupIds, newGroupNames }),
      );
    }

    it("leaves a group of another user out of the saved contact", async () => {
      const { a, b } = await twoUsers();
      const theirs = await addGroup(a, "Друзья");
      const mine = await addGroup(b, "Семья");
      const boris = await addContact(b, "Борис");

      await save(b, boris.id, [theirs.id, mine.id]);

      expect((await listContactGroups(b, boris.id)).map((group) => group.name)).toEqual(["Семья"]);
      expect(await listGroups(a)).toEqual([{ id: theirs.id, name: "Друзья", contactCount: 0 }]);
    });

    it("makes a group of its own when another user has one with the same name", async () => {
      const { a, b } = await twoUsers();
      const theirs = await addGroup(a, "Теннис");
      const boris = await addContact(b, "Борис");

      await save(b, boris.id, [], ["теннис"]);

      const [own] = await listContactGroups(b, boris.id);
      expect(own.name).toBe("теннис");
      expect(own.id).not.toBe(theirs.id);
      expect(await listGroups(a)).toEqual([{ id: theirs.id, name: "Теннис", contactCount: 0 }]);
    });

    it("does not touch the groups of a contact of another user", async () => {
      const { a, b } = await twoUsers();
      const theirs = await addGroup(a, "Друзья");
      const anna = await addContact(a, "Анна");
      await addToGroup(anna.id, theirs.id);

      await save(b, anna.id, []);

      expect(await listContactGroups(a, anna.id)).toHaveLength(1);
    });
  });
});
