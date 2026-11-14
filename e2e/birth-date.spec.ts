// The «Дата рождения» field of the contact form and the «День рождения» line of the card,
// on the real database and a real login
import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./auth";
import { addContact, clearDatabase, closeDatabase } from "./database";

test.beforeEach(async ({ page }) => {
  await clearDatabase();
  await signIn(page);
});

test.afterAll(async () => {
  await closeDatabase();
});

const birthDate = (page: Page) => page.getByRole("group", { name: "Дата рождения" });
const dayInput = (page: Page) =>
  birthDate(page).getByRole("textbox", { name: "День", exact: true });
const monthSelect = (page: Page) =>
  birthDate(page).getByRole("combobox", { name: "Месяц", exact: true });
const yearInput = (page: Page) =>
  birthDate(page).getByRole("textbox", { name: "Год", exact: true });

// The «День рождения» line of the card: its label and what stands next to it
const birthdayRow = (page: Page) =>
  page.locator("dl > div").filter({ has: page.getByText("День рождения", { exact: true }) });

async function fillBirthDate(page: Page, day: string, month: string, year: string) {
  await dayInput(page).fill(day);
  await monthSelect(page).selectOption({ label: month });
  await yearInput(page).fill(year);
}

test("adds a contact with a full birth date and shows it in the card", async ({ page }) => {
  await page.goto("/contacts/new");
  await page.getByRole("textbox", { name: "Имя" }).fill("Борис");
  await fillBirthDate(page, "18", "ноября", "1990");
  await page.getByRole("button", { name: "Добавить контакт" }).click();

  await expect(page.getByRole("heading", { name: "Борис" })).toBeVisible();
  await expect(birthdayRow(page)).toContainText("18 ноября 1990 г.");
});

test("adds a contact with a date without a year", async ({ page }) => {
  await page.goto("/contacts/new");
  await page.getByRole("textbox", { name: "Имя" }).fill("Вера");
  await fillBirthDate(page, "3", "марта", "");
  await page.getByRole("button", { name: "Добавить контакт" }).click();

  await expect(page.getByRole("heading", { name: "Вера" })).toBeVisible();
  await expect(birthdayRow(page)).toContainText("3 марта");
  await expect(birthdayRow(page)).not.toContainText("1990");
});

test("tells that the year may be left out", async ({ page }) => {
  await page.goto("/contacts/new");

  await expect(page.getByText("Год можно не указывать")).toBeVisible();
  await expect(monthSelect(page)).toHaveValue("");
});

test("shows a dash for a contact without a birth date", async ({ page }) => {
  const contact = await addContact("Анна");

  await page.goto(`/contacts/${contact.id}`);

  await expect(birthdayRow(page)).toContainText("—");
});

test("a contact added without touching the field has no birth date", async ({ page }) => {
  await page.goto("/contacts/new");
  await page.getByRole("textbox", { name: "Имя" }).fill("Глеб");
  await page.getByRole("button", { name: "Добавить контакт" }).click();

  await expect(page.getByRole("heading", { name: "Глеб" })).toBeVisible();
  await expect(birthdayRow(page)).toContainText("—");
});

test("the edit form shows the saved date, and a changed date is saved", async ({ page }) => {
  const contact = await addContact("Борис", { birthDay: 18, birthMonth: 11, birthYear: 1990 });

  await page.goto(`/contacts/${contact.id}/edit`);
  await expect(dayInput(page)).toHaveValue("18");
  await expect(monthSelect(page).locator("option:checked")).toHaveText("ноября");
  await expect(yearInput(page)).toHaveValue("1990");

  await dayInput(page).fill("19");
  await page.getByRole("button", { name: "Сохранить" }).click();

  await expect(birthdayRow(page)).toContainText("19 ноября 1990 г.");
});

test("clearing the day, the month and the year takes the date away", async ({ page }) => {
  const contact = await addContact("Борис", { birthDay: 18, birthMonth: 11, birthYear: 1990 });

  await page.goto(`/contacts/${contact.id}/edit`);
  await dayInput(page).fill("");
  await monthSelect(page).selectOption({ value: "" });
  await yearInput(page).fill("");
  await page.getByRole("button", { name: "Сохранить" }).click();

  await expect(page.getByRole("heading", { name: "Борис" })).toBeVisible();
  await expect(birthdayRow(page)).toContainText("—");
});

test("clearing only the year keeps the day and the month", async ({ page }) => {
  const contact = await addContact("Борис", { birthDay: 18, birthMonth: 11, birthYear: 1990 });

  await page.goto(`/contacts/${contact.id}/edit`);
  await yearInput(page).fill("");
  await page.getByRole("button", { name: "Сохранить" }).click();

  await expect(birthdayRow(page)).toContainText("18 ноября");
  await expect(birthdayRow(page)).not.toContainText("1990");
});

test("saving the form without touching the date leaves it as it was", async ({ page }) => {
  const contact = await addContact("Борис", { birthDay: 18, birthMonth: 11, birthYear: 1990 });

  await page.goto(`/contacts/${contact.id}/edit`);
  await page.getByRole("textbox", { name: "Имя" }).fill("Борис Петров");
  await page.getByRole("button", { name: "Сохранить" }).click();

  await expect(page.getByRole("heading", { name: "Борис Петров" })).toBeVisible();
  await expect(birthdayRow(page)).toContainText("18 ноября 1990 г.");
});

test("April 31 is refused with a message and what was typed stays in the form", async ({
  page,
}) => {
  await page.goto("/contacts/new");
  await page.getByRole("textbox", { name: "Имя" }).fill("Борис");
  await fillBirthDate(page, "31", "апреля", "1990");
  await page.getByRole("button", { name: "Добавить контакт" }).click();

  await expect(birthDate(page).getByText("Такой даты нет")).toBeVisible();
  await expect(page).toHaveURL("/contacts/new");
  await expect(page.getByRole("textbox", { name: "Имя" })).toHaveValue("Борис");
  await expect(dayInput(page)).toHaveValue("31");
  await expect(monthSelect(page).locator("option:checked")).toHaveText("апреля");
  await expect(yearInput(page)).toHaveValue("1990");

  // Fixed and sent again: the contact is saved
  await dayInput(page).fill("30");
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  await expect(birthdayRow(page)).toContainText("30 апреля 1990 г.");
});

test("a day without a month is refused, and so is a year out of range", async ({ page }) => {
  await page.goto("/contacts/new");
  await page.getByRole("textbox", { name: "Имя" }).fill("Борис");
  await dayInput(page).fill("18");
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  await expect(birthDate(page).getByText("Укажите день и месяц")).toBeVisible();

  await fillBirthDate(page, "18", "ноября", "1899");
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  await expect(birthDate(page).getByText("Год — от 1900 до текущего")).toBeVisible();
});

test("a wrong date in the edit form changes nothing in the contact", async ({ page }) => {
  const contact = await addContact("Борис", { birthDay: 18, birthMonth: 11, birthYear: 1990 });

  await page.goto(`/contacts/${contact.id}/edit`);
  await dayInput(page).fill("31");
  await monthSelect(page).selectOption({ label: "апреля" });
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(birthDate(page).getByText("Такой даты нет")).toBeVisible();

  await page.goto(`/contacts/${contact.id}`);
  await expect(birthdayRow(page)).toContainText("18 ноября 1990 г.");
});

test("February 29 is saved without a year", async ({ page }) => {
  await page.goto("/contacts/new");
  await page.getByRole("textbox", { name: "Имя" }).fill("Борис");
  await fillBirthDate(page, "29", "февраля", "");
  await page.getByRole("button", { name: "Добавить контакт" }).click();

  await expect(birthdayRow(page)).toContainText("29 февраля");
});

test("the three parts of the date fit a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/contacts/new");
  await fillBirthDate(page, "30", "сентября", "1990");

  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalScroll).toBe(false);
  for (const part of [dayInput(page), monthSelect(page), yearInput(page)]) {
    const box = await part.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  }
  // Side by side, not wrapped under each other
  const [day, month, year] = await Promise.all(
    [dayInput(page), monthSelect(page), yearInput(page)].map((part) => part.boundingBox()),
  );
  expect(month!.y).toBe(day!.y);
  expect(year!.y).toBe(day!.y);
});
