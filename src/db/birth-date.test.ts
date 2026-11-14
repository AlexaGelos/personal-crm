// The birth date columns of contacts and the CHECK constraints that keep an impossible date out
// of the database even when a query goes around the app
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { contacts } from "@/db/schema";
import { addContact, TEST_USER_ID } from "@/test/helpers";

type BirthDate = {
  birthDay?: number | null;
  birthMonth?: number | null;
  birthYear?: number | null;
};

// 23514 is "check_violation" in PostgreSQL; DatabaseQueryError (redact-errors.ts) carries the code
async function violatedCheck(fields: BirthDate) {
  try {
    await addContact(TEST_USER_ID, "Борис", fields);
  } catch (error) {
    const code = (error as { code?: string }).code;
    return code === "23514" ? "check_violation" : String(error);
  }
  return null;
}

describe("birth date constraints", () => {
  it("refuses a day without a month", async () => {
    expect(await violatedCheck({ birthDay: 18 })).toBe("check_violation");
  });

  it("refuses a month without a day", async () => {
    expect(await violatedCheck({ birthMonth: 11 })).toBe("check_violation");
  });

  it("refuses a year without a day and a month", async () => {
    expect(await violatedCheck({ birthYear: 1990 })).toBe("check_violation");
  });

  it("refuses month 13 and month 0", async () => {
    expect(await violatedCheck({ birthDay: 1, birthMonth: 13 })).toBe("check_violation");
    expect(await violatedCheck({ birthDay: 1, birthMonth: 0 })).toBe("check_violation");
  });

  it("refuses day 32 and day 0", async () => {
    expect(await violatedCheck({ birthDay: 32, birthMonth: 1 })).toBe("check_violation");
    expect(await violatedCheck({ birthDay: 0, birthMonth: 1 })).toBe("check_violation");
  });

  it("refuses a day that no year has: April 31, June 31, September 31, November 31", async () => {
    for (const month of [4, 6, 9, 11]) {
      expect(await violatedCheck({ birthDay: 31, birthMonth: month }), `month ${month}`).toBe(
        "check_violation",
      );
    }
  });

  it("refuses February 30", async () => {
    expect(await violatedCheck({ birthDay: 30, birthMonth: 2 })).toBe("check_violation");
  });

  it("refuses the year 1899 and a year above 2200", async () => {
    expect(await violatedCheck({ birthDay: 18, birthMonth: 11, birthYear: 1899 })).toBe(
      "check_violation",
    );
    expect(await violatedCheck({ birthDay: 18, birthMonth: 11, birthYear: 2201 })).toBe(
      "check_violation",
    );
  });

  it("accepts February 29, with a year and without", async () => {
    expect(await violatedCheck({ birthDay: 29, birthMonth: 2 })).toBeNull();
    expect(await violatedCheck({ birthDay: 29, birthMonth: 2, birthYear: 2000 })).toBeNull();
  });

  it("accepts the last day of every month", async () => {
    const lastDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (const [index, birthDay] of lastDays.entries()) {
      const birthMonth = index + 1;
      expect(await violatedCheck({ birthDay, birthMonth }), `month ${birthMonth}`).toBeNull();
    }
  });

  it("accepts a date without a year and a date with the year 1900", async () => {
    expect(await violatedCheck({ birthDay: 3, birthMonth: 3 })).toBeNull();
    expect(await violatedCheck({ birthDay: 1, birthMonth: 1, birthYear: 1900 })).toBeNull();
  });

  it("accepts no date at all", async () => {
    expect(await violatedCheck({})).toBeNull();
    expect(await violatedCheck({ birthDay: null, birthMonth: null, birthYear: null })).toBeNull();
  });

  it("refuses to change an existing contact to an impossible date", async () => {
    const boris = await addContact(TEST_USER_ID, "Борис", { birthDay: 18, birthMonth: 11 });

    await expect(
      db.update(contacts).set({ birthDay: 31, birthMonth: 4 }).where(eq(contacts.id, boris.id)),
    ).rejects.toThrow();

    const [stored] = await db.select().from(contacts).where(eq(contacts.id, boris.id));
    expect([stored.birthDay, stored.birthMonth]).toEqual([18, 11]);
  });
});

describe("contacts that were there before the birth date", () => {
  it("have no birth date and keep their other data", async () => {
    const boris = await addContact(TEST_USER_ID, "Борис", {
      about: "Школьный друг",
      phone: "+7 916 123-45-67",
      contactFrequency: "month",
    });

    const [stored] = await db.select().from(contacts).where(eq(contacts.id, boris.id));

    expect([stored.birthDay, stored.birthMonth, stored.birthYear]).toEqual([null, null, null]);
    expect(stored).toMatchObject({
      name: "Борис",
      about: "Школьный друг",
      phone: "+7 916 123-45-67",
      contactFrequency: "month",
    });
  });
});
