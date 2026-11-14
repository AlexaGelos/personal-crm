import { describe, expect, it } from "vitest";

import {
  CONTACT_FORMS,
  birthMonthNames,
  formatBirthDate,
  formatBirthdayIn,
  formatDay,
  formatOverdue,
  formatTurns,
  pluralize,
} from "@/lib/format";

describe("formatOverdue", () => {
  it("puts the right ending after the number of days", () => {
    expect(formatOverdue(1)).toBe("просрочено на 1 день");
    expect(formatOverdue(3)).toBe("просрочено на 3 дня");
    expect(formatOverdue(11)).toBe("просрочено на 11 дней");
    expect(formatOverdue(21)).toBe("просрочено на 21 день");
    expect(formatOverdue(35)).toBe("просрочено на 35 дней");
  });
});

describe("pluralize", () => {
  it("puts the right ending after the number of contacts", () => {
    expect(pluralize(1, CONTACT_FORMS)).toBe("1 контакт");
    expect(pluralize(3, CONTACT_FORMS)).toBe("3 контакта");
    expect(pluralize(7, CONTACT_FORMS)).toBe("7 контактов");
  });
});

describe("formatDay", () => {
  it("writes a due date the way the card shows it", () => {
    expect(formatDay("2026-11-15")).toBe("15 ноября 2026 г.");
  });
});

describe("formatBirthdayIn", () => {
  it("says «Сегодня» and «Завтра» for the first two days", () => {
    expect(formatBirthdayIn(0)).toBe("Сегодня");
    expect(formatBirthdayIn(1)).toBe("Завтра");
  });

  it("puts the right ending after the number of days", () => {
    expect(formatBirthdayIn(2)).toBe("Через 2 дня");
    expect(formatBirthdayIn(4)).toBe("Через 4 дня");
    expect(formatBirthdayIn(5)).toBe("Через 5 дней");
    expect(formatBirthdayIn(7)).toBe("Через 7 дней");
  });
});

describe("formatBirthDate", () => {
  it("writes the date with the year the way the card shows it", () => {
    expect(formatBirthDate(18, 11, 1990)).toBe("18 ноября 1990 г.");
  });

  it("writes the date without the year when it is not known", () => {
    expect(formatBirthDate(18, 11, null)).toBe("18 ноября");
    expect(formatBirthDate(3, 3, null)).toBe("3 марта");
  });

  it("keeps February 29 without a year", () => {
    expect(formatBirthDate(29, 2, null)).toBe("29 февраля");
    expect(formatBirthDate(29, 2, 2000)).toBe("29 февраля 2000 г.");
  });

  it("names every month", () => {
    const months = [
      "января",
      "февраля",
      "марта",
      "апреля",
      "мая",
      "июня",
      "июля",
      "августа",
      "сентября",
      "октября",
      "ноября",
      "декабря",
    ];
    months.forEach((name, index) => {
      expect(formatBirthDate(1, index + 1, null)).toBe(`1 ${name}`);
    });
  });
});

describe("formatTurns", () => {
  it("says how old the person turns", () => {
    expect(formatTurns(36)).toBe("исполняется 36");
    expect(formatTurns(1)).toBe("исполняется 1");
  });
});

describe("birthMonthNames", () => {
  it("lists the twelve months the way a date is written", () => {
    expect(birthMonthNames).toHaveLength(12);
    expect(birthMonthNames[0]).toBe("января");
    expect(birthMonthNames[10]).toBe("ноября");
    expect(birthMonthNames[11]).toBe("декабря");
  });
});
