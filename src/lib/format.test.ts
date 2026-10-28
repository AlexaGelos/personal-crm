import { describe, expect, it } from "vitest";

import { CONTACT_FORMS, formatDay, formatOverdue, pluralize } from "@/lib/format";

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
