import { describe, expect, it } from "vitest";

import { groupNameKey, groupNameSchema, loginEmailSchema, parseGroupId } from "@/lib/validation";

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
