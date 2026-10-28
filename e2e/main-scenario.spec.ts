// The main scenario from specs/01-продуктовая-идея.md, end to end on a real database:
// open -> see the contacts, add a contact -> it is in the list,
// find it -> open the card -> write a note -> the note is saved
import { expect, test, type Page } from "@playwright/test";

import { addContacts, addNotes, clearDatabase, closeDatabase } from "./database";

test.beforeEach(async () => {
  await clearDatabase();
});

test.afterAll(async () => {
  await closeDatabase();
});

const pad = (n: number) => String(n).padStart(3, "0");

// Names of the contacts in the list, top to bottom
function listedNames(page: Page) {
  return page.getByRole("table").getByRole("link");
}

test("the list shows 50 contacts at a time in alphabetical order, search looks through all of them", async ({
  page,
}) => {
  // 50 + 70: the first page holds only "Анна", every "Борис" is further down
  const annas = Array.from({ length: 50 }, (_, i) => `Анна Тестова ${pad(i + 1)}`);
  const borises = Array.from({ length: 70 }, (_, i) => `Борис Пробный ${pad(i + 1)}`);
  const alphabetical = [...annas, ...borises];
  // Stored out of order, so the order on the screen comes from sorting, not from insertion
  await addContacts([...alphabetical].reverse());

  await page.goto("/");
  await expect(page.getByText("Показано 50 из 120")).toBeVisible();
  await expect(listedNames(page)).toHaveText(alphabetical.slice(0, 50));

  await page.getByRole("button", { name: "Показать ещё" }).click();
  await expect(page.getByText("Показано 100 из 120")).toBeVisible();
  await expect(listedNames(page)).toHaveText(alphabetical.slice(0, 100));

  await page.getByRole("button", { name: "Показать ещё" }).click();
  await expect(page.getByText("Всего 120 контактов")).toBeVisible();
  await expect(listedNames(page)).toHaveText(alphabetical);
  await expect(page.getByRole("button", { name: "Показать ещё" })).toBeHidden();

  // From a fresh page: none of the "Борис" are shown, the search still finds them
  await page.goto("/");
  await expect(listedNames(page)).toHaveText(annas);
  await page.getByRole("searchbox").fill("Борис");
  await expect(page.getByText("Найдено: 70, показано 50")).toBeVisible();
  await expect(listedNames(page)).toHaveText(borises.slice(0, 50));
});

test("added contact is found by name, a note written in the card is saved and seen from another browser", async ({
  page,
  browser,
}) => {
  await addContacts(["Вера Соседова", "Глеб Коллегин"]);

  // Open: the list is there
  await page.goto("/");
  await expect(listedNames(page)).toHaveText(["Вера Соседова", "Глеб Коллегин"]);

  // Add a contact
  await page.getByRole("link", { name: "Добавить контакт" }).click();
  await page.getByRole("textbox", { name: "Имя" }).fill("Ярослава Новикова");
  await page.getByRole("textbox", { name: "Кто это" }).fill("Архитектор");
  await page.getByRole("textbox", { name: "Откуда знакомы" }).fill("Вместе ходили в поход на Эльбрус");
  await page.getByRole("textbox", { name: "Телефон" }).fill("+7 900 123-45-67");
  await page.getByRole("textbox", { name: "Почта" }).fill("yaroslava@example.com");
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ярослава Новикова" })).toBeVisible();

  // It is in the list
  await page.getByRole("link", { name: "Все контакты" }).click();
  await expect(listedNames(page)).toHaveText([
    "Вера Соседова",
    "Глеб Коллегин",
    "Ярослава Новикова",
  ]);

  // Find it by name and open the card
  await page.getByRole("searchbox").fill("Новикова");
  await expect(page.getByText("Найдено: 1 (всего 3 контакта)")).toBeVisible();
  await expect(listedNames(page)).toHaveText(["Ярослава Новикова"]);
  await listedNames(page).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Ярослава Новикова" })).toBeVisible();

  // Write a note after the talk
  const note = "Договорились созвониться в пятницу насчёт ремонта";
  await page.getByRole("textbox", { name: "Новая заметка" }).fill(note);
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  const notes = page.getByRole("region", { name: "Заметки" }).getByRole("listitem");
  await expect(notes).toHaveCount(1);
  await expect(notes.first()).toContainText(note);
  // The form is ready for the next note
  await expect(page.getByRole("textbox", { name: "Новая заметка" })).toHaveValue("");

  // Saved, not just shown: it is still there after a reload
  await page.reload();
  await expect(notes).toHaveCount(1);
  await expect(notes.first()).toContainText(note);

  // Another browser at the same address sees the same contacts and the note
  const otherBrowser = await browser.newContext();
  try {
    const other = await otherBrowser.newPage();
    await other.goto("/");
    await expect(listedNames(other)).toHaveText([
      "Вера Соседова",
      "Глеб Коллегин",
      "Ярослава Новикова",
    ]);
    await listedNames(other).filter({ hasText: "Ярослава Новикова" }).click();
    // Only inside the card: the list stays in the page, hidden, with the same phone and email
    const card = other.locator('[data-slot="card"]').filter({
      has: other.getByRole("heading", { level: 1, name: "Ярослава Новикова" }),
    });
    await expect(card).toContainText("Архитектор");
    await expect(card).toContainText("Вместе ходили в поход на Эльбрус");
    await expect(card.getByRole("link", { name: "+7 900 123-45-67" })).toBeVisible();
    await expect(card.getByRole("link", { name: "yaroslava@example.com" })).toBeVisible();
    const otherNotes = other.getByRole("region", { name: "Заметки" }).getByRole("listitem");
    await expect(otherNotes).toHaveCount(1);
    await expect(otherNotes.first()).toContainText(note);
  } finally {
    await otherBrowser.close();
  }
});

test("the card shows all notes at once, without «Показать ещё»", async ({ page }) => {
  const [contact] = await addContacts(["Дмитрий Болтливый"]);
  const bodies = Array.from({ length: 60 }, (_, i) => `Разговор номер ${pad(i + 1)}`);
  await addNotes(contact.id, bodies);

  await page.goto(`/contacts/${contact.id}`);
  const notes = page.getByRole("region", { name: "Заметки" });
  await expect(notes.getByText("60 заметок")).toBeVisible();
  await expect(notes.getByRole("listitem")).toHaveCount(60);
  for (const body of bodies) {
    await expect(notes.getByText(body, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Показать ещё" })).toBeHidden();
});
