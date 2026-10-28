import { describe, expect, it } from "vitest";

import { countContacts, listContacts, listOverdueContacts } from "@/lib/data";
import { addContact, addGroup, addNote, addToGroup } from "@/test/helpers";

describe("countContacts", () => {
  it("is 0 on an empty database", async () => {
    expect(await countContacts()).toBe(0);
  });

  it("counts only the contacts of the group", async () => {
    const tennis = await addGroup("Теннис");
    const anna = await addContact("Анна");
    const boris = await addContact("Борис");
    await addContact("Вера");
    await addToGroup(anna.id, tennis.id);
    await addToGroup(boris.id, tennis.id);

    expect(await countContacts("", tennis.id)).toBe(2);
    expect(await countContacts()).toBe(3);
  });

  it("counts the matches of a search inside the group", async () => {
    const tennis = await addGroup("Теннис");
    const anna = await addContact("Анна");
    const andrey = await addContact("Андрей");
    const boris = await addContact("Борис");
    await addContact("Анна Смирнова");
    for (const contact of [anna, andrey, boris]) await addToGroup(contact.id, tennis.id);

    expect(await countContacts("Ан", tennis.id)).toBe(2);
    expect(await countContacts("Ан")).toBe(3);
  });
});

describe("listContacts", () => {
  it("lists all contacts alphabetically without a group", async () => {
    await addContact("Борис");
    await addContact("Анна");

    const rows = await listContacts({ query: "", limit: 50 });

    expect(rows.map((row) => row.name)).toEqual(["Анна", "Борис"]);
  });

  it("lists only the contacts of the group, alphabetically", async () => {
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    const vera = await addContact("Вера");
    const anna = await addContact("Анна");
    const boris = await addContact("Борис");
    await addToGroup(vera.id, tennis.id);
    await addToGroup(anna.id, tennis.id);
    await addToGroup(boris.id, family.id);

    const rows = await listContacts({ query: "", limit: 50, groupId: tennis.id });

    expect(rows.map((row) => row.name)).toEqual(["Анна", "Вера"]);
  });

  it("searches only inside the group", async () => {
    const tennis = await addGroup("Теннис");
    const anna = await addContact("Анна");
    await addContact("Анна Смирнова");
    await addToGroup(anna.id, tennis.id);

    const rows = await listContacts({ query: "Анна", limit: 50, groupId: tennis.id });

    expect(rows.map((row) => row.name)).toEqual(["Анна"]);
  });

  it("finds nobody when the group has no such person", async () => {
    const tennis = await addGroup("Теннис");
    const anna = await addContact("Анна");
    await addContact("Вергилий");
    await addToGroup(anna.id, tennis.id);

    expect(await listContacts({ query: "Вергилий", limit: 50, groupId: tennis.id })).toEqual([]);
  });

  it("shows no more than the limit", async () => {
    const tennis = await addGroup("Теннис");
    for (const name of ["Анна", "Борис", "Вера"]) {
      await addToGroup((await addContact(name)).id, tennis.id);
    }

    const rows = await listContacts({ query: "", limit: 2, groupId: tennis.id });

    expect(rows.map((row) => row.name)).toEqual(["Анна", "Борис"]);
  });

  it("gives each contact the names of its groups alphabetically", async () => {
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    const anna = await addContact("Анна");
    await addContact("Борис");
    await addToGroup(anna.id, tennis.id);
    await addToGroup(anna.id, family.id);

    const rows = await listContacts({ query: "", limit: 50 });

    expect(rows.map((row) => row.groupNames)).toEqual([["Семья", "Теннис"], []]);
  });

  it("shows all groups of a contact even when one of them is selected", async () => {
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    const anna = await addContact("Анна");
    await addToGroup(anna.id, tennis.id);
    await addToGroup(anna.id, family.id);

    const [row] = await listContacts({ query: "", limit: 50, groupId: tennis.id });

    expect(row.groupNames).toEqual(["Семья", "Теннис"]);
  });
});

describe("listOverdueContacts", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

  // Weekly contact added a month ago and never contacted: well overdue
  function addOverdue(name: string, days = 30) {
    return addContact(name, { contactFrequency: "week", createdAt: daysAgo(days) });
  }

  it("lists the overdue contacts, the most overdue first, with their total", async () => {
    await addOverdue("Вера", 20);
    await addOverdue("Борис", 40);
    await addContact("Анна");
    await addContact("Глеб", { contactFrequency: "week" });

    const rows = await listOverdueContacts();

    expect(rows.map((row) => row.name)).toEqual(["Борис", "Вера"]);
    expect(rows.map((row) => row.total)).toEqual([2, 2]);
  });

  it("lists only the overdue contacts of the selected group and counts only them", async () => {
    const tennis = await addGroup("Теннис");
    const family = await addGroup("Семья");
    const boris = await addOverdue("Борис", 40);
    const vera = await addOverdue("Вера", 20);
    const anna = await addOverdue("Анна", 10);
    await addToGroup(boris.id, tennis.id);
    await addToGroup(vera.id, family.id);
    await addToGroup(anna.id, tennis.id);

    const rows = await listOverdueContacts(undefined, tennis.id);

    expect(rows.map((row) => row.name)).toEqual(["Борис", "Анна"]);
    expect(rows.map((row) => row.total)).toEqual([2, 2]);
  });

  it("counts the whole group when the list is cut by the limit", async () => {
    const tennis = await addGroup("Теннис");
    for (const [name, days] of [["Анна", 10], ["Борис", 20], ["Вера", 30]] as const) {
      await addToGroup((await addOverdue(name, days)).id, tennis.id);
    }

    const rows = await listOverdueContacts(2, tennis.id);

    expect(rows.map((row) => row.name)).toEqual(["Вера", "Борис"]);
    expect(rows[0].total).toBe(3);
  });

  it("is empty when nobody in the group is overdue", async () => {
    const tennis = await addGroup("Теннис");
    await addOverdue("Вера");
    const anna = await addContact("Анна", { contactFrequency: "week" });
    await addToGroup(anna.id, tennis.id);

    expect(await listOverdueContacts(undefined, tennis.id)).toEqual([]);
  });

  it("takes the notes into account: a fresh note ends the overdue", async () => {
    const tennis = await addGroup("Теннис");
    const boris = await addOverdue("Борис");
    await addToGroup(boris.id, tennis.id);
    await addNote(boris.id, "Созвонились");

    expect(await listOverdueContacts(undefined, tennis.id)).toEqual([]);
  });
});
