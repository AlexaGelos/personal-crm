// The «Скоро день рождения» block of the home page end to end, on a real database and a real login.
// "Today" is the real one: the database counts it, so the birthdays are put a set number of days
// ahead of today, and the expected texts are written with the app's own functions
import { expect, test, type Page } from "@playwright/test";

import { birthMonthNames, formatBirthDate } from "@/lib/format";
import { addDays, onDay, today } from "@/test/days";
import { signIn } from "./auth";
import { addContact, addGroup, addToGroup, clearDatabase, closeDatabase } from "./database";

test.beforeEach(async ({ page }) => {
  await clearDatabase();
  // A real login before every test: the app is closed to those who are not in
  await signIn(page);
});

test.afterAll(async () => {
  await closeDatabase();
});

function block(page: Page) {
  return page.getByRole("region", { name: "Скоро день рождения" });
}

// Names in the block, top to bottom
function blockNames(page: Page) {
  return block(page).getByRole("listitem").getByRole("link");
}

// The birthday `days` days from today. With an age - the year is such that the person turns it
// on that day; without - the year is not known
function bornIn(days: number, age: number | null = null) {
  const [year, month, day] = addDays(today(), days).split("-").map(Number);
  return { birthDay: day, birthMonth: month, birthYear: age === null ? null : year - age };
}

// The date as the block writes it: without the year
function dateIn(days: number) {
  const { birthDay, birthMonth } = bornIn(days);
  return formatBirthDate(birthDay, birthMonth, null);
}

function addBorn(name: string, days: number, fields: { about?: string; age?: number } = {}) {
  const { age, ...rest } = fields;
  return addContact(name, { ...bornIn(days, age), ...rest });
}

test("shows the nearest birthdays, the nearest first, one day in alphabetical order", async ({
  page,
}) => {
  await addBorn("Вера", 6);
  await addBorn("Яков", 3);
  await addBorn("Борис", 1);
  await addBorn("Анна", 3);
  // Not shown: far away, a day ago, no date
  await addBorn("Глеб", 8);
  await addBorn("Ева", -1);
  await addContact("Дарья");

  await page.goto("/");

  await expect(blockNames(page)).toHaveText(["Борис", "Анна", "Яков", "Вера"]);
  await expect(block(page).getByRole("heading", { name: "Скоро день рождения" })).toBeVisible();
});

test("a row has the name, who it is, when, the date and the age", async ({ page }) => {
  await addBorn("Борис", 4, { about: "школьный друг", age: 36 });

  await page.goto("/");

  const row = block(page).getByRole("listitem");
  await expect(row.getByRole("link", { name: "Борис" })).toBeVisible();
  await expect(row).toContainText("школьный друг");
  await expect(row).toContainText("Через 4 дня");
  await expect(row).toContainText(dateIn(4));
  await expect(row).toContainText("исполняется 36");
  // The year of birth itself is not in the block
  await expect(row).not.toContainText(String(bornIn(4, 36).birthYear));
  // No «Связались» here
  await expect(row.getByRole("button")).toHaveCount(0);
});

test("says «Сегодня», «Завтра» and the days with the right ending", async ({ page }) => {
  const expected = [
    ["Анна", 0, "Сегодня"],
    ["Борис", 1, "Завтра"],
    ["Вера", 2, "Через 2 дня"],
    ["Глеб", 5, "Через 5 дней"],
    ["Дарья", 7, "Через 7 дней"],
  ] as const;
  for (const [name, days] of expected) await addBorn(name, days);

  await page.goto("/");

  for (const [name, , text] of expected) {
    await expect(block(page).getByRole("listitem").filter({ hasText: name })).toContainText(text);
  }
});

test("a contact without the year has no age", async ({ page }) => {
  await addBorn("Вера", 2);

  await page.goto("/");

  await expect(block(page).getByRole("listitem")).toContainText(dateIn(2));
  await expect(block(page).getByRole("listitem")).not.toContainText("исполняется");
});

test("the name opens the card", async ({ page }) => {
  await addBorn("Борис", 2);

  await page.goto("/");
  await block(page).getByRole("link", { name: "Борис" }).click();

  await expect(page).toHaveURL(/\/contacts\/\d+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Борис" })).toBeVisible();
});

test("stands under «Пора связаться» and above the search", async ({ page }) => {
  await addBorn("Борис", 2);
  await addContact("Анна", {
    contactFrequency: "week",
    createdAt: onDay(addDays(today(), -30)),
  });

  await page.goto("/");

  const keepInTouch = page.getByRole("region", { name: "Пора связаться" });
  await expect(keepInTouch).toBeVisible();
  await expect(block(page)).toBeVisible();
  const [keep, birthdays, search] = await Promise.all([
    keepInTouch.boundingBox(),
    block(page).boundingBox(),
    page.getByRole("searchbox").boundingBox(),
  ]);
  expect(keep!.y + keep!.height).toBeLessThanOrEqual(birthdays!.y);
  expect(birthdays!.y + birthdays!.height).toBeLessThanOrEqual(search!.y);
});

test("follows the chosen group, and is not there when the group has nobody soon", async ({
  page,
}) => {
  const tennis = await addGroup("Теннис");
  const family = await addGroup("Семья");
  const work = await addGroup("Работа");
  const boris = await addBorn("Борис", 1);
  const vera = await addBorn("Вера", 2);
  const oleg = await addBorn("Олег", 100);
  await addToGroup(boris.id, tennis.id);
  await addToGroup(vera.id, family.id);
  await addToGroup(oleg.id, work.id);
  const groupsRow = page.getByRole("navigation", { name: "Группы" });

  await page.goto("/");
  await expect(blockNames(page)).toHaveText(["Борис", "Вера"]);

  await groupsRow.getByRole("link", { name: "Теннис" }).click();
  await expect(blockNames(page)).toHaveText(["Борис"]);

  await groupsRow.getByRole("link", { name: "Работа" }).click();
  await expect(page.getByRole("table").getByRole("link")).toHaveText(["Олег"]);
  await expect(block(page)).toBeHidden();

  await groupsRow.getByRole("link", { name: "Все" }).click();
  await expect(blockNames(page)).toHaveText(["Борис", "Вера"]);
});

test("is not on the page when nobody has a birthday soon", async ({ page }) => {
  await addBorn("Борис", 30);
  await addContact("Анна");

  await page.goto("/");

  await expect(page.getByRole("table").getByRole("link")).toHaveText(["Анна", "Борис"]);
  await expect(block(page)).toBeHidden();
  await expect(page.getByRole("heading", { name: "Скоро день рождения" })).toBeHidden();
});

test("is gone while searching and comes back when the search is cleared", async ({ page }) => {
  await addBorn("Борис", 2);
  await addContact("Анна");

  await page.goto("/");
  await expect(blockNames(page)).toHaveText(["Борис"]);

  await page.getByRole("searchbox").fill("Анна");
  await expect(page.getByRole("table").getByRole("link")).toHaveText(["Анна"]);
  await expect(block(page)).toBeHidden();

  await page.getByRole("searchbox").fill("");
  await expect(blockNames(page)).toHaveText(["Борис"]);
});

test("a deleted contact leaves the block", async ({ page }) => {
  const boris = await addBorn("Борис", 2);
  await addBorn("Вера", 3);

  await page.goto(`/contacts/${boris.id}`);
  await page.getByRole("button", { name: "Удалить" }).click();
  await page
    .getByRole("alertdialog", { name: "Удалить контакт?" })
    .getByRole("button", { name: "Удалить" })
    .click();

  await expect(page.getByText("Контакт «Борис» удалён")).toBeVisible();
  await expect(blockNames(page)).toHaveText(["Вера"]);
});

test("a date put in the form shows in the block at once, and a date taken away is gone", async ({
  page,
}) => {
  const boris = await addContact("Борис");
  await page.goto("/");
  await expect(block(page)).toBeHidden();

  // Tomorrow's birthday in the edit form
  const tomorrow = bornIn(1);
  await page.goto(`/contacts/${boris.id}/edit`);
  const date = page.getByRole("group", { name: "Дата рождения" });
  await date.getByRole("textbox", { name: "День", exact: true }).fill(String(tomorrow.birthDay));
  await date
    .getByRole("combobox", { name: "Месяц", exact: true })
    .selectOption({ label: birthMonthNames[tomorrow.birthMonth - 1] });
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Борис" })).toBeVisible();

  // Back to the home page the way a person goes: with the link
  await page.getByRole("link", { name: "Все контакты" }).click();
  await expect(blockNames(page)).toHaveText(["Борис"]);
  await expect(block(page)).toContainText("Завтра");

  // The date is taken away: the block is gone
  await page.getByRole("link", { name: "Борис" }).first().click();
  await page.getByRole("link", { name: "Изменить" }).click();
  await date.getByRole("textbox", { name: "День", exact: true }).fill("");
  await date.getByRole("combobox", { name: "Месяц", exact: true }).selectOption({ value: "" });
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Борис" })).toBeVisible();
  await page.getByRole("link", { name: "Все контакты" }).click();
  await expect(page.getByRole("table").getByRole("link")).toHaveText(["Борис"]);
  await expect(block(page)).toBeHidden();
});

test("on a phone the row fits the screen at any width", async ({ page }) => {
  await addBorn("Буонконте да Монтефельтро", 5, {
    about: "Гибеллин, павший при Кампальдино",
    age: 36,
  });

  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await expect(blockNames(page)).toHaveCount(1);

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect.soft(hasHorizontalScroll, `at ${width}px`).toBe(false);
    const row = (await block(page).getByRole("listitem").boundingBox())!;
    expect.soft(row.x + row.width, `at ${width}px`).toBeLessThanOrEqual(width);
  }
});
