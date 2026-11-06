import { describe, expect, it } from "vitest";

import {
  countContacts,
  getContact,
  listContacts,
  listNotes,
  listOverdueContacts,
} from "@/lib/data";
import { addDays, addMonths, onDay, today } from "@/test/days";
import { addContact, addGroup, addNote, addToGroup, addUser, TEST_USER_ID } from "@/test/helpers";

describe("countContacts", () => {
  it("is 0 on an empty database", async () => {
    expect(await countContacts(TEST_USER_ID)).toBe(0);
  });

  it("counts only the contacts of the group", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const anna = await addContact(TEST_USER_ID, "Анна");
    const boris = await addContact(TEST_USER_ID, "Борис");
    await addContact(TEST_USER_ID, "Вера");
    await addToGroup(anna.id, tennis.id);
    await addToGroup(boris.id, tennis.id);

    expect(await countContacts(TEST_USER_ID, "", tennis.id)).toBe(2);
    expect(await countContacts(TEST_USER_ID)).toBe(3);
  });

  it("counts the matches of a search inside the group", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const anna = await addContact(TEST_USER_ID, "Анна");
    const andrey = await addContact(TEST_USER_ID, "Андрей");
    const boris = await addContact(TEST_USER_ID, "Борис");
    await addContact(TEST_USER_ID, "Анна Смирнова");
    for (const contact of [anna, andrey, boris]) await addToGroup(contact.id, tennis.id);

    expect(await countContacts(TEST_USER_ID, "Ан", tennis.id)).toBe(2);
    expect(await countContacts(TEST_USER_ID, "Ан")).toBe(3);
  });
});

describe("listContacts", () => {
  it("lists all contacts alphabetically without a group", async () => {
    await addContact(TEST_USER_ID, "Борис");
    await addContact(TEST_USER_ID, "Анна");

    const rows = await listContacts(TEST_USER_ID, { query: "", limit: 50 });

    expect(rows.map((row) => row.name)).toEqual(["Анна", "Борис"]);
  });

  it("lists only the contacts of the group, alphabetically", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const family = await addGroup(TEST_USER_ID, "Семья");
    const vera = await addContact(TEST_USER_ID, "Вера");
    const anna = await addContact(TEST_USER_ID, "Анна");
    const boris = await addContact(TEST_USER_ID, "Борис");
    await addToGroup(vera.id, tennis.id);
    await addToGroup(anna.id, tennis.id);
    await addToGroup(boris.id, family.id);

    const rows = await listContacts(TEST_USER_ID, { query: "", limit: 50, groupId: tennis.id });

    expect(rows.map((row) => row.name)).toEqual(["Анна", "Вера"]);
  });

  it("searches only inside the group", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const anna = await addContact(TEST_USER_ID, "Анна");
    await addContact(TEST_USER_ID, "Анна Смирнова");
    await addToGroup(anna.id, tennis.id);

    const rows = await listContacts(TEST_USER_ID, { query: "Анна", limit: 50, groupId: tennis.id });

    expect(rows.map((row) => row.name)).toEqual(["Анна"]);
  });

  it("finds nobody when the group has no such person", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const anna = await addContact(TEST_USER_ID, "Анна");
    await addContact(TEST_USER_ID, "Вергилий");
    await addToGroup(anna.id, tennis.id);

    expect(
      await listContacts(TEST_USER_ID, { query: "Вергилий", limit: 50, groupId: tennis.id }),
    ).toEqual([]);
  });

  it("shows no more than the limit", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    for (const name of ["Анна", "Борис", "Вера"]) {
      await addToGroup((await addContact(TEST_USER_ID, name)).id, tennis.id);
    }

    const rows = await listContacts(TEST_USER_ID, { query: "", limit: 2, groupId: tennis.id });

    expect(rows.map((row) => row.name)).toEqual(["Анна", "Борис"]);
  });

  it("gives each contact the names of its groups alphabetically", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const family = await addGroup(TEST_USER_ID, "Семья");
    const anna = await addContact(TEST_USER_ID, "Анна");
    await addContact(TEST_USER_ID, "Борис");
    await addToGroup(anna.id, tennis.id);
    await addToGroup(anna.id, family.id);

    const rows = await listContacts(TEST_USER_ID, { query: "", limit: 50 });

    expect(rows.map((row) => row.groupNames)).toEqual([["Семья", "Теннис"], []]);
  });

  it("shows all groups of a contact even when one of them is selected", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const family = await addGroup(TEST_USER_ID, "Семья");
    const anna = await addContact(TEST_USER_ID, "Анна");
    await addToGroup(anna.id, tennis.id);
    await addToGroup(anna.id, family.id);

    const [row] = await listContacts(TEST_USER_ID, { query: "", limit: 50, groupId: tennis.id });

    expect(row.groupNames).toEqual(["Семья", "Теннис"]);
  });
});

describe("listOverdueContacts", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

  // Weekly contact added a month ago and never contacted: well overdue
  function addOverdue(name: string, days = 30) {
    return addContact(TEST_USER_ID, name, { contactFrequency: "week", createdAt: daysAgo(days) });
  }

  it("lists the overdue contacts, the most overdue first, with their total", async () => {
    await addOverdue("Вера", 20);
    await addOverdue("Борис", 40);
    await addContact(TEST_USER_ID, "Анна");
    await addContact(TEST_USER_ID, "Глеб", { contactFrequency: "week" });

    const rows = await listOverdueContacts(TEST_USER_ID);

    expect(rows.map((row) => row.name)).toEqual(["Борис", "Вера"]);
    expect(rows.map((row) => row.total)).toEqual([2, 2]);
  });

  it("lists only the overdue contacts of the selected group and counts only them", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const family = await addGroup(TEST_USER_ID, "Семья");
    const boris = await addOverdue("Борис", 40);
    const vera = await addOverdue("Вера", 20);
    const anna = await addOverdue("Анна", 10);
    await addToGroup(boris.id, tennis.id);
    await addToGroup(vera.id, family.id);
    await addToGroup(anna.id, tennis.id);

    const rows = await listOverdueContacts(TEST_USER_ID, undefined, tennis.id);

    expect(rows.map((row) => row.name)).toEqual(["Борис", "Анна"]);
    expect(rows.map((row) => row.total)).toEqual([2, 2]);
  });

  it("counts the whole group when the list is cut by the limit", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    for (const [name, days] of [
      ["Анна", 10],
      ["Борис", 20],
      ["Вера", 30],
    ] as const) {
      await addToGroup((await addOverdue(name, days)).id, tennis.id);
    }

    const rows = await listOverdueContacts(TEST_USER_ID, 2, tennis.id);

    expect(rows.map((row) => row.name)).toEqual(["Вера", "Борис"]);
    expect(rows[0].total).toBe(3);
  });

  it("is empty when nobody in the group is overdue", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    await addOverdue("Вера");
    const anna = await addContact(TEST_USER_ID, "Анна", { contactFrequency: "week" });
    await addToGroup(anna.id, tennis.id);

    expect(await listOverdueContacts(TEST_USER_ID, undefined, tennis.id)).toEqual([]);
  });

  it("takes the notes into account: a fresh note ends the overdue", async () => {
    const tennis = await addGroup(TEST_USER_ID, "Теннис");
    const boris = await addOverdue("Борис");
    await addToGroup(boris.id, tennis.id);
    await addNote(boris.id, "Созвонились");

    expect(await listOverdueContacts(TEST_USER_ID, undefined, tennis.id)).toEqual([]);
  });

  it("puts the contacts overdue by the same number of days in alphabetical order", async () => {
    await addOverdue("Вера", 17);
    await addOverdue("Аркадий", 17);

    const rows = await listOverdueContacts(TEST_USER_ID);

    expect(rows.map((row) => [row.name, row.overdueDays])).toEqual([
      ["Аркадий", 10],
      ["Вера", 10],
    ]);
  });

  it("leaves out the contacts without a frequency, not due yet or due today", async () => {
    const weekAgo = onDay(addDays(today(), -7));
    await addContact(TEST_USER_ID, "Анна", { createdAt: daysAgo(100) });
    await addContact(TEST_USER_ID, "Глеб", { contactFrequency: "month", createdAt: weekAgo });
    await addContact(TEST_USER_ID, "Дарья", { contactFrequency: "week", createdAt: weekAgo });
    await addContact(TEST_USER_ID, "Борис", {
      contactFrequency: "week",
      createdAt: onDay(addDays(today(), -8)),
    });

    const rows = await listOverdueContacts(TEST_USER_ID);

    expect(rows.map((row) => [row.name, row.overdueDays])).toEqual([["Борис", 1]]);
  });
});

// Moments below are Moscow time: the zone the tests run in (vitest.config.mts)
describe("getContact: when it's time to get in touch", () => {
  // Weekly: the due date is the day of the last contact plus 7 days
  function addWeekly(createdAt: string, lastContactedAt?: string) {
    return addContact(TEST_USER_ID, "Борис", {
      contactFrequency: "week",
      createdAt: new Date(createdAt),
      lastContactedAt: lastContactedAt ? new Date(lastContactedAt) : undefined,
    });
  }

  async function dueDateOf(contactId: number) {
    return (await getContact(TEST_USER_ID, contactId))?.dueDate;
  }

  it("counts from the newest note", async () => {
    const boris = await addWeekly("2026-08-01T10:00:00+03:00");
    await addNote(boris.id, "Встретились", new Date("2026-09-03T19:00:00+03:00"));
    await addNote(boris.id, "Созвонились", new Date("2026-09-12T19:00:00+03:00"));

    expect(await dueDateOf(boris.id)).toBe("2026-09-19");
  });

  it("counts from the day the contact was added without notes and «Связались»", async () => {
    const boris = await addWeekly("2026-08-01T10:00:00+03:00");

    expect(await dueDateOf(boris.id)).toBe("2026-08-08");
  });

  it("counts from «Связались» when it is later than the newest note", async () => {
    const boris = await addWeekly("2026-08-01T10:00:00+03:00", "2026-09-20T10:00:00+03:00");
    await addNote(boris.id, "Созвонились", new Date("2026-09-12T19:00:00+03:00"));

    expect(await dueDateOf(boris.id)).toBe("2026-09-27");
  });

  it("counts from the note when it is later than «Связались», keeping the «Связались» date", async () => {
    const lastContactedAt = "2026-09-20T10:00:00+03:00";
    const boris = await addWeekly("2026-08-01T10:00:00+03:00", lastContactedAt);
    await addNote(boris.id, "Созвонились", new Date("2026-09-25T19:00:00+03:00"));

    const contact = await getContact(TEST_USER_ID, boris.id);
    expect(contact?.dueDate).toBe("2026-10-02");
    expect(contact?.lastContactedAt).toEqual(new Date(lastContactedAt));
  });

  it("starts the count again from the day of a new note", async () => {
    const boris = await addWeekly("2026-08-01T10:00:00+03:00");
    await addNote(boris.id, "Созвонились");

    const contact = await getContact(TEST_USER_ID, boris.id);
    expect(contact?.dueDate).toBe(addDays(today(), 7));
    expect(contact?.overdueDays).toBe(-7);
  });

  it("adds a week to the last contact", async () => {
    const boris = await addWeekly("2026-10-15T10:00:00+03:00");

    expect(await dueDateOf(boris.id)).toBe("2026-10-22");
  });

  it("is not overdue on the due day, overdue by 1 day the day after and by 7 a week later", async () => {
    const overdueDays = async (daysSinceLastContact: number) => {
      const contact = await addContact(TEST_USER_ID, "Борис", {
        contactFrequency: "week",
        createdAt: onDay(addDays(today(), -daysSinceLastContact)),
      });
      return (await getContact(TEST_USER_ID, contact.id))?.overdueDays;
    };

    expect(await overdueDays(7)).toBe(0);
    expect(await overdueDays(8)).toBe(1);
    expect(await overdueDays(14)).toBe(7);
  });

  it("adds a calendar month: January 31 is followed by February 28", async () => {
    const boris = await addContact(TEST_USER_ID, "Борис", {
      contactFrequency: "month",
      createdAt: new Date("2027-01-31T10:00:00+03:00"),
    });

    expect(await dueDateOf(boris.id)).toBe("2027-02-28");
  });

  it("adds 3 months for a quarter and 12 for a year", async () => {
    const createdAt = new Date("2026-03-10T10:00:00+03:00");
    const quarterly = await addContact(TEST_USER_ID, "Анна", {
      contactFrequency: "quarter",
      createdAt,
    });
    const yearly = await addContact(TEST_USER_ID, "Борис", { contactFrequency: "year", createdAt });

    expect(await dueDateOf(quarterly.id)).toBe("2026-06-10");
    expect(await dueDateOf(yearly.id)).toBe("2027-03-10");
  });

  it("takes the day of a note as it is shown, late in the evening and just after midnight", async () => {
    const evening = await addWeekly("2026-08-01T10:00:00+03:00");
    await addNote(evening.id, "Поздний звонок", new Date("2026-10-15T23:50:00+03:00"));
    const night = await addWeekly("2026-08-01T10:00:00+03:00");
    await addNote(night.id, "Ночной звонок", new Date("2026-10-16T00:10:00+03:00"));

    expect(await dueDateOf(evening.id)).toBe("2026-10-22");
    expect(await dueDateOf(night.id)).toBe("2026-10-23");
  });

  it("gives the due date while it has not passed", async () => {
    const lastContact = addDays(today(), -7);
    const anna = await addContact(TEST_USER_ID, "Анна", {
      contactFrequency: "month",
      createdAt: onDay(lastContact),
    });

    const contact = await getContact(TEST_USER_ID, anna.id);
    expect(contact?.dueDate).toBe(addMonths(lastContact, 1));
    expect(contact?.overdueDays).toBeLessThanOrEqual(0);
  });

  it("gives the days past the due date", async () => {
    const boris = await addContact(TEST_USER_ID, "Борис", {
      contactFrequency: "week",
      createdAt: onDay(addDays(today(), -12)),
    });

    expect((await getContact(TEST_USER_ID, boris.id))?.overdueDays).toBe(5);
  });

  it("has no due date without a frequency", async () => {
    const anna = await addContact(TEST_USER_ID, "Анна", {
      createdAt: onDay(addDays(today(), -100)),
      lastContactedAt: onDay(addDays(today(), -50)),
    });

    const contact = await getContact(TEST_USER_ID, anna.id);
    expect(contact?.dueDate).toBeNull();
    expect(contact?.overdueDays).toBeNull();
  });

  it("counts from «Связались» pressed before the frequency was set", async () => {
    const anna = await addContact(TEST_USER_ID, "Анна", {
      createdAt: onDay(addDays(today(), -100)),
      lastContactedAt: new Date(),
      contactFrequency: "month",
    });

    expect(await dueDateOf(anna.id)).toBe(addMonths(today(), 1));
  });
});

// Two users: B must never get anything of A in any answer
describe("data of another user", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  async function twoUsers() {
    const a = await addUser("a@example.com");
    const b = await addUser("b@example.com");
    return { a: a.id, b: b.id };
  }

  it("counts only the contacts of the user", async () => {
    const { a, b } = await twoUsers();
    for (const name of ["Анна", "Борис", "Вера"]) await addContact(a, name);
    for (const name of ["Глеб", "Дарья"]) await addContact(b, name);

    expect(await countContacts(b)).toBe(2);
    expect(await countContacts(a)).toBe(3);
  });

  it("lists only the contacts of the user", async () => {
    const { a, b } = await twoUsers();
    await addContact(a, "Анна");
    await addContact(b, "Борис");

    const rows = await listContacts(b, { query: "", limit: 50 });

    expect(rows.map((row) => row.name)).toEqual(["Борис"]);
  });

  it("searches and counts only inside the contacts of the user", async () => {
    const { a, b } = await twoUsers();
    await addContact(a, "Анна Иванова", { phone: "+7 916 123-45-67" });
    await addContact(b, "Анна Петрова");

    const rows = await listContacts(b, { query: "Анна", limit: 50 });

    expect(rows.map((row) => row.name)).toEqual(["Анна Петрова"]);
    expect(await countContacts(b, "Анна")).toBe(1);
    // By phone as well
    expect(await listContacts(b, { query: "916 123", limit: 50 })).toEqual([]);
  });

  it("counts and lists nothing of another user's group", async () => {
    const { a, b } = await twoUsers();
    const tennis = await addGroup(a, "Теннис");
    const anna = await addContact(a, "Анна");
    await addToGroup(anna.id, tennis.id);

    expect(await listContacts(b, { query: "", limit: 50, groupId: tennis.id })).toEqual([]);
    expect(await countContacts(b, "", tennis.id)).toBe(0);
  });

  it("leaves the groups of another user out of the group names", async () => {
    const { a, b } = await twoUsers();
    const tennis = await addGroup(a, "Теннис");
    const anna = await addContact(a, "Анна");
    await addToGroup(anna.id, tennis.id);
    const boris = await addContact(b, "Борис");

    const [row] = await listContacts(b, { query: "", limit: 50 });

    expect(row.id).toBe(boris.id);
    expect(row.groupNames).toEqual([]);
  });

  it("leaves another user's contact out of «Пора связаться»", async () => {
    const { a, b } = await twoUsers();
    await addContact(a, "Анна", {
      contactFrequency: "week",
      createdAt: new Date(Date.now() - 30 * DAY_MS),
    });

    expect(await listOverdueContacts(b)).toEqual([]);
    expect(await listOverdueContacts(a)).toHaveLength(1);
  });

  it("finds no card of another user's contact", async () => {
    const { a, b } = await twoUsers();
    const anna = await addContact(a, "Анна");

    expect(await getContact(b, anna.id)).toBeUndefined();
    expect(await getContact(a, anna.id)).toMatchObject({ id: anna.id });
  });

  it("gives no notes of another user's contact", async () => {
    const { a, b } = await twoUsers();
    const anna = await addContact(a, "Анна");
    await addNote(anna.id, "Обсудили отпуск");

    expect(await listNotes(b, anna.id)).toEqual([]);
    expect(await listNotes(a, anna.id)).toHaveLength(1);
  });
});
