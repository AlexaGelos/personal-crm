// The «Группы» section of the contact form keeps what the person checked:
// after saving and opening the form again, and after a form error
import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./auth";
import { addContact, addGroup, clearDatabase, closeDatabase } from "./database";

test.beforeEach(async ({ page }) => {
  await clearDatabase();
  // A real login before every test: the app is closed to those who are not in
  await signIn(page);
});

test.afterAll(async () => {
  await closeDatabase();
});

const BAD_PHONE = "не номер";

const groupBox = (page: Page, name: string) => page.getByRole("checkbox", { name });

// The check box itself is hidden and its label sits on top: a person presses the label
const chip = (page: Page, name: string) =>
  page.locator("label").filter({ has: groupBox(page, name) });

// The groups of the contact in its card
const cardGroup = (page: Page, name: string) => page.getByRole("link", { name, exact: true });

test("a group saved in the edit form is checked when the form is opened again, and it stays after saving again", async ({
  page,
}) => {
  const contact = await addContact("Данте Алигьери");
  await addGroup("Ад");
  await addGroup("Рай");

  await page.goto(`/contacts/${contact.id}`);
  await page.getByRole("link", { name: "Изменить" }).click();
  await chip(page, "Ад").click();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(cardGroup(page, "Ад")).toBeVisible();

  // Open the form again: the group saved a moment ago is checked, the other one is not
  await page.getByRole("link", { name: "Изменить" }).click();
  await expect(groupBox(page, "Ад")).toBeChecked();
  await expect(groupBox(page, "Рай")).not.toBeChecked();

  // Saved without touching the groups: the contact is still in the group
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(cardGroup(page, "Ад")).toBeVisible();

  // The same after a third visit, now taking the group off and putting another one on
  await page.getByRole("link", { name: "Изменить" }).click();
  await expect(groupBox(page, "Ад")).toBeChecked();
  await chip(page, "Ад").click();
  await chip(page, "Рай").click();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(cardGroup(page, "Рай")).toBeVisible();
  await expect(cardGroup(page, "Ад")).toBeHidden();

  await page.getByRole("link", { name: "Изменить" }).click();
  await expect(groupBox(page, "Рай")).toBeChecked();
  await expect(groupBox(page, "Ад")).not.toBeChecked();
});

test("a form error in the edit form keeps the checked groups", async ({ page }) => {
  const contact = await addContact("Данте Алигьери");
  await addGroup("Ад");
  await addGroup("Рай");

  await page.goto(`/contacts/${contact.id}/edit`);
  await chip(page, "Ад").click();
  await page.getByRole("textbox", { name: "Телефон" }).fill(BAD_PHONE);
  await page.getByRole("button", { name: "Сохранить" }).click();

  await expect(page.getByText("Телефон может содержать только цифры")).toBeVisible();
  await expect(groupBox(page, "Ад")).toBeChecked();
  await expect(groupBox(page, "Рай")).not.toBeChecked();

  // The typed phone is still there too; fixing it saves the contact with the group
  await expect(page.getByRole("textbox", { name: "Телефон" })).toHaveValue(BAD_PHONE);
  await page.getByRole("textbox", { name: "Телефон" }).fill("+7 900 123-45-67");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(cardGroup(page, "Ад")).toBeVisible();
});

test("a form error in the new contact form keeps the checked groups and the typed new group", async ({
  page,
}) => {
  await addGroup("Ад");
  await addGroup("Рай");

  await page.goto("/contacts/new");
  await page.getByRole("textbox", { name: "Имя" }).fill("Беатриче Портинари");
  await chip(page, "Рай").click();
  await page.getByRole("textbox", { name: "Новая группа" }).fill("Муза");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await page.getByRole("textbox", { name: "Телефон" }).fill(BAD_PHONE);
  await page.getByRole("button", { name: "Добавить контакт" }).click();

  await expect(page.getByText("Телефон может содержать только цифры")).toBeVisible();
  await expect(groupBox(page, "Рай")).toBeChecked();
  await expect(groupBox(page, "Ад")).not.toBeChecked();
  await expect(groupBox(page, "Муза")).toBeChecked();

  await page.getByRole("textbox", { name: "Телефон" }).fill("");
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  await expect(cardGroup(page, "Рай")).toBeVisible();
  await expect(cardGroup(page, "Муза")).toBeVisible();
  await expect(cardGroup(page, "Ад")).toBeHidden();
});
