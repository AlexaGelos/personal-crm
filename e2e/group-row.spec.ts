// The row of groups on the home page takes two lines at most on any screen: the groups that do
// not fit hide behind «Ещё N», which opens the whole row in place
import { expect, test, type Locator, type Page } from "@playwright/test";

import { addGroup, clearDatabase, closeDatabase } from "./database";

// The groups of the test data
const MANY = [
  "IT",
  "Ад",
  "Античность",
  "Белые гвельфы",
  "Битва при Кампальдино",
  "Врачи",
  "Гибеллины",
  "Друзья детства",
  "Друзья юности",
  "Изгнание",
  "Конференции и митапы",
  "Курсы и клубы",
  "Мастера и услуги",
  "Пизанцы",
  "Пистойцы",
  "Поэты",
  "Правители",
  "Проводники",
  "Путешествия",
  "Работа",
  "Рай",
  "Родительский чат",
  "Родня Алигьери",
  "Романья",
  "Святые и духовенство",
  "Север Италии",
  "Семья",
  "Сиенцы",
  "Соседи",
  "Спорт",
  "Стражи",
  "Университет",
  "Флорентийцы",
  "Франция и Прованс",
  "Художники",
  "Через знакомых",
  "Чёрные гвельфы",
  "Чистилище",
  "Школа",
  "Юг Италии и Сицилия",
];

const WIDTHS = [320, 390, 768, 1280];

test.beforeEach(async () => {
  await clearDatabase();
});

test.afterAll(async () => {
  await closeDatabase();
});

const groupsRow = (page: Page) => page.getByRole("navigation", { name: "Группы" });

// Lines the row takes: the different heights its buttons stand at
async function lineCount(row: Locator) {
  return row.evaluate(
    (nav) =>
      new Set([...nav.children].map((child) => Math.round(child.getBoundingClientRect().top))).size,
  );
}

for (const width of WIDTHS) {
  test(`at ${width}px many groups take two lines, «Ещё» opens and closes the rest`, async ({
    page,
  }) => {
    for (const name of MANY) await addGroup(name);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const row = groupsRow(page);
    const more = row.getByRole("button", { name: /^Ещё \d+$/ });
    await expect(more).toBeVisible();
    expect(await lineCount(row)).toBeLessThanOrEqual(2);
    await expect(row.getByRole("link", { name: "Настроить группы" })).toBeHidden();

    // The groups in sight and the hidden ones make all of them; "Все" is a link too
    const hidden = Number((await more.textContent())!.match(/\d+/)![0]);
    const shown = (await row.getByRole("link").count()) - 1;
    expect(shown).toBeGreaterThan(0);
    expect(shown + hidden).toBe(MANY.length);

    await more.click();
    for (const name of MANY) {
      await expect(row.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(row.getByRole("link", { name: "Настроить группы" })).toBeVisible();

    await row.getByRole("button", { name: "Свернуть" }).click();
    await expect(more).toBeVisible();
    expect(await lineCount(row)).toBeLessThanOrEqual(2);
  });
}

test("a chosen group from the hidden part opens the whole row", async ({ page }) => {
  const groups = [];
  for (const name of MANY) groups.push(await addGroup(name));
  const last = groups.find((group) => group.name === "Юг Италии и Сицилия")!;
  await page.setViewportSize({ width: 390, height: 900 });

  // As after «Назад» from a card of this group's contact
  await page.goto(`/?group=${last.id}`);
  const row = groupsRow(page);
  await expect(row.getByRole("link", { name: last.name })).toHaveAttribute("aria-current", "true");
  await expect(row.getByRole("link", { name: last.name })).toBeVisible();
  await expect(row.getByRole("button", { name: "Свернуть" })).toBeVisible();
});

test("a few groups stay as before, without «Ещё»", async ({ page }) => {
  for (const name of ["Семья", "Работа", "Теннис"]) await addGroup(name);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");

  const row = groupsRow(page);
  await expect(row.getByRole("link", { name: "Настроить группы" })).toBeVisible();
  await expect(row.getByRole("link")).toHaveText([
    "Все",
    "Работа",
    "Семья",
    "Теннис",
    /Настроить группы/,
  ]);
  await expect(row.getByRole("button", { name: /^Ещё/ })).toHaveCount(0);
});
