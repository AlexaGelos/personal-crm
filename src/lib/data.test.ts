import { describe, expect, it } from "vitest";

import { countContacts, getContact, listContacts, listOverdueContacts } from "@/lib/data";
import { addDays, addMonths, onDay, today } from "@/test/days";
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
    for (const [name, days] of [
      ["Анна", 10],
      ["Борис", 20],
      ["Вера", 30],
    ] as const) {
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

  it("puts the contacts overdue by the same number of days in alphabetical order", async () => {
    await addOverdue("Вера", 17);
    await addOverdue("Аркадий", 17);

    const rows = await listOverdueContacts();

    expect(rows.map((row) => [row.name, row.overdueDays])).toEqual([
      ["Аркадий", 10],
      ["Вера", 10],
    ]);
  });

  it("leaves out the contacts without a frequency, not due yet or due today", async () => {
    const weekAgo = onDay(addDays(today(), -7));
    await addContact("Анна", { createdAt: daysAgo(100) });
    await addContact("Глеб", { contactFrequency: "month", createdAt: weekAgo });
    await addContact("Дарья", { contactFrequency: "week", createdAt: weekAgo });
    await addContact("Борис", {
      contactFrequency: "week",
      createdAt: onDay(addDays(today(), -8)),
    });

    const rows = await listOverdueContacts();

    expect(rows.map((row) => [row.name, row.overdueDays])).toEqual([["Борис", 1]]);
  });
});

// Moments below are Moscow time: the zone the tests run in (vitest.config.mts)
describe("getContact: when it's time to get in touch", () => {
  // Weekly: the due date is the day of the last contact plus 7 days
  function addWeekly(createdAt: string, lastContactedAt?: string) {
    return addContact("Борис", {
      contactFrequency: "week",
      createdAt: new Date(createdAt),
      lastContactedAt: lastContactedAt ? new Date(lastContactedAt) : undefined,
    });
  }

  async function dueDateOf(contactId: number) {
    return (await getContact(contactId))?.dueDate;
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

    const contact = await getContact(boris.id);
    expect(contact?.dueDate).toBe("2026-10-02");
    expect(contact?.lastContactedAt).toEqual(new Date(lastContactedAt));
  });

  it("starts the count again from the day of a new note", async () => {
    const boris = await addWeekly("2026-08-01T10:00:00+03:00");
    await addNote(boris.id, "Созвонились");

    const contact = await getContact(boris.id);
    expect(contact?.dueDate).toBe(addDays(today(), 7));
    expect(contact?.overdueDays).toBe(-7);
  });

  it("adds a week to the last contact", async () => {
    const boris = await addWeekly("2026-10-15T10:00:00+03:00");

    expect(await dueDateOf(boris.id)).toBe("2026-10-22");
  });

  it("is not overdue on the due day, overdue by 1 day the day after and by 7 a week later", async () => {
    const overdueDays = async (daysSinceLastContact: number) => {
      const contact = await addContact("Борис", {
        contactFrequency: "week",
        createdAt: onDay(addDays(today(), -daysSinceLastContact)),
      });
      return (await getContact(contact.id))?.overdueDays;
    };

    expect(await overdueDays(7)).toBe(0);
    expect(await overdueDays(8)).toBe(1);
    expect(await overdueDays(14)).toBe(7);
  });

  it("adds a calendar month: January 31 is followed by February 28", async () => {
    const boris = await addContact("Борис", {
      contactFrequency: "month",
      createdAt: new Date("2027-01-31T10:00:00+03:00"),
    });

    expect(await dueDateOf(boris.id)).toBe("2027-02-28");
  });

  it("adds 3 months for a quarter and 12 for a year", async () => {
    const createdAt = new Date("2026-03-10T10:00:00+03:00");
    const quarterly = await addContact("Анна", { contactFrequency: "quarter", createdAt });
    const yearly = await addContact("Борис", { contactFrequency: "year", createdAt });

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
    const anna = await addContact("Анна", {
      contactFrequency: "month",
      createdAt: onDay(lastContact),
    });

    const contact = await getContact(anna.id);
    expect(contact?.dueDate).toBe(addMonths(lastContact, 1));
    expect(contact?.overdueDays).toBeLessThanOrEqual(0);
  });

  it("gives the days past the due date", async () => {
    const boris = await addContact("Борис", {
      contactFrequency: "week",
      createdAt: onDay(addDays(today(), -12)),
    });

    expect((await getContact(boris.id))?.overdueDays).toBe(5);
  });

  it("has no due date without a frequency", async () => {
    const anna = await addContact("Анна", {
      createdAt: onDay(addDays(today(), -100)),
      lastContactedAt: onDay(addDays(today(), -50)),
    });

    const contact = await getContact(anna.id);
    expect(contact?.dueDate).toBeNull();
    expect(contact?.overdueDays).toBeNull();
  });

  it("counts from «Связались» pressed before the frequency was set", async () => {
    const anna = await addContact("Анна", {
      createdAt: onDay(addDays(today(), -100)),
      lastContactedAt: new Date(),
      contactFrequency: "month",
    });

    expect(await dueDateOf(anna.id)).toBe(addMonths(today(), 1));
  });
});
