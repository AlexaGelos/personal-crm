import { describe, expect, it } from "vitest";

import {
  birthDateSchema,
  groupNameKey,
  groupNameSchema,
  loginEmailSchema,
  parseGroupId,
} from "@/lib/validation";

describe("groupNameSchema", () => {
  function firstError(name: string) {
    const result = groupNameSchema.safeParse(name);
    return result.success ? null : result.error.issues[0].message;
  }

  it("asks for a name when it is empty or only spaces", () => {
    expect(firstError("")).toBe("Укажите название");
    expect(firstError("   ")).toBe("Укажите название");
  });

  it("refuses 51 characters", () => {
    expect(firstError("а".repeat(51))).toBe("Не больше 50 символов");
  });

  it("accepts 50 characters", () => {
    expect(groupNameSchema.parse("а".repeat(50))).toBe("а".repeat(50));
  });

  it("drops spaces at the edges", () => {
    expect(groupNameSchema.parse("  Аналитики  ")).toBe("Аналитики");
  });

  it("counts the length without the spaces at the edges", () => {
    expect(groupNameSchema.safeParse(` ${"а".repeat(50)} `).success).toBe(true);
  });
});

describe("groupNameKey", () => {
  it("gives one key to names that differ in case or in ё / е", () => {
    const key = groupNameKey("Ёлка");
    expect(groupNameKey("ЁЛКА")).toBe(key);
    expect(groupNameKey("Елка")).toBe(key);
    expect(groupNameKey("елка")).toBe(key);
  });

  it("gives different keys to different names", () => {
    expect(groupNameKey("Ёлка")).not.toBe(groupNameKey("Ель"));
  });
});

describe("parseGroupId", () => {
  it("reads a positive whole number", () => {
    expect(parseGroupId("5")).toBe(5);
  });

  it("gives nothing for anything else", () => {
    expect(parseGroupId("abc")).toBeNull();
    expect(parseGroupId("0")).toBeNull();
    expect(parseGroupId("-1")).toBeNull();
    expect(parseGroupId("1.5")).toBeNull();
    expect(parseGroupId("")).toBeNull();
    expect(parseGroupId(undefined)).toBeNull();
    expect(parseGroupId(["1", "2"])).toBeNull();
    expect(parseGroupId("99999999999")).toBeNull();
  });
});

describe("loginEmailSchema", () => {
  function firstError(email: string) {
    const result = loginEmailSchema.safeParse(email);
    return result.success ? null : result.error.issues[0].message;
  }

  it("drops the spaces at the edges and the capital letters", () => {
    expect(loginEmailSchema.parse("  Anna@Example.COM  ")).toBe("anna@example.com");
  });

  it("refuses an address that is not one, with the same words as the form", () => {
    for (const email of ["anna@", "anna", "@example.com", "anna example@com", "a@b@c.ru"]) {
      expect(firstError(email), email).toBe("Проверь адрес почты");
    }
  });

  it("refuses an empty field and a field of spaces", () => {
    expect(firstError("")).toBe("Проверь адрес почты");
    expect(firstError("   ")).toBe("Проверь адрес почты");
  });

  it("refuses an address that is too long", () => {
    expect(firstError(`${"a".repeat(250)}@example.com`)).toBe("Проверь адрес почты");
  });
});

describe("birthDateSchema", () => {
  const thisYear = new Date().getFullYear();

  function parse(birthDay: string, birthMonth: string, birthYear = "") {
    return birthDateSchema.safeParse({ birthDay, birthMonth, birthYear });
  }

  function firstError(birthDay: string, birthMonth: string, birthYear = "") {
    const result = parse(birthDay, birthMonth, birthYear);
    return result.success ? null : result.error.issues[0].message;
  }

  it("takes empty fields as «не задана»", () => {
    expect(parse("", "", "")).toMatchObject({ success: true, data: null });
    expect(parse("  ", "", " ")).toMatchObject({ success: true, data: null });
  });

  it("reads a full date and a date without a year", () => {
    expect(parse("18", "11", "1990")).toMatchObject({
      success: true,
      data: { day: 18, month: 11, year: 1990 },
    });
    expect(parse("3", "3", "")).toMatchObject({
      success: true,
      data: { day: 3, month: 3, year: null },
    });
  });

  it("drops the spaces at the edges", () => {
    expect(parse(" 18 ", "11", " 1990 ")).toMatchObject({
      success: true,
      data: { day: 18, month: 11, year: 1990 },
    });
  });

  it("asks for the day and the month when there is only the day", () => {
    expect(firstError("18", "")).toBe("Укажите день и месяц");
  });

  it("asks for the day and the month when there is only the month", () => {
    expect(firstError("", "11")).toBe("Укажите день и месяц");
  });

  it("asks for the day and the month when there is only the year", () => {
    expect(firstError("", "", "1990")).toBe("Укажите день и месяц");
  });

  it("refuses April 31", () => {
    expect(firstError("31", "4")).toBe("Такой даты нет");
  });

  it("refuses day 0, day 32, month 0 and month 13", () => {
    expect(firstError("0", "5")).toBe("Такой даты нет");
    expect(firstError("32", "5")).toBe("Такой даты нет");
    expect(firstError("5", "0")).toBe("Такой даты нет");
    expect(firstError("5", "13")).toBe("Такой даты нет");
  });

  it("accepts February 29 without a year and in a leap year, refuses it in the others", () => {
    expect(parse("29", "2").success).toBe(true);
    expect(parse("29", "2", "2000").success).toBe(true);
    expect(firstError("29", "2", "2001")).toBe("Такой даты нет");
    // 1900 was not a leap year
    expect(firstError("29", "2", "1900")).toBe("Такой даты нет");
  });

  it("refuses February 30", () => {
    expect(firstError("30", "2")).toBe("Такой даты нет");
  });

  it("refuses the year 1899 and a year that has not come yet", () => {
    const message = "Год — от 1900 до текущего";
    expect(firstError("18", "11", "1899")).toBe(message);
    expect(firstError("18", "11", String(thisYear + 1))).toBe(message);
    expect(firstError("18", "11", "0")).toBe(message);
  });

  it("accepts the year 1900 and the current year", () => {
    expect(parse("18", "11", "1900").success).toBe(true);
    expect(parse("1", "1", String(thisYear)).success).toBe(true);
  });

  it("refuses letters and signs instead of numbers", () => {
    expect(firstError("ab", "11")).toBe("Такой даты нет");
    expect(firstError("18", "11", "abcd")).toBe("Такой даты нет");
    expect(firstError("1.5", "11")).toBe("Такой даты нет");
    expect(firstError("-3", "11")).toBe("Такой даты нет");
    expect(firstError("18", "ноября")).toBe("Такой даты нет");
    expect(firstError("18", "11", "19 90")).toBe("Такой даты нет");
  });

  it("refuses a year too long to be one", () => {
    expect(firstError("18", "11", "99999999999999999999")).toBe("Год — от 1900 до текущего");
  });
});
