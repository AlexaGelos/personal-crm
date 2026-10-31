// "Пора связаться" end to end on a real database: the frequency in the card, «Связались»
// with «Отменить» in the home block and in the card, the block itself.
// "Today" is the real one: the database counts it, so the contacts are put a set number of
// days into the past, and the expected dates are written with the app's own formatDay()
import { expect, test, type Page } from "@playwright/test";

import { formatDay, formatOverdue } from "@/lib/format";
import { addDays, addMonths, daysBetween, onDay, today } from "@/test/days";
import { addContact, addGroup, addToGroup, clearDatabase, closeDatabase } from "./database";

test.beforeEach(async () => {
  await clearDatabase();
});

test.afterAll(async () => {
  await closeDatabase();
});

function block(page: Page) {
  return page.getByRole("region", { name: "Пора связаться" });
}

// Names in the block, top to bottom
function blockNames(page: Page) {
  return block(page).getByRole("listitem").getByRole("link");
}

// Weekly, last contact a week and `days` more ago: overdue by `days`
function addOverdue(name: string, days: number, fields: { about?: string } = {}) {
  return addContact(name, {
    contactFrequency: "week",
    createdAt: onDay(addDays(today(), -(days + 7))),
    ...fields,
  });
}

test("the frequency is set in the card with one press, kept and cleared", async ({
  page,
  browser,
}) => {
  const added = addDays(today(), -40);
  const boris = await addContact("Борис Петров", { createdAt: onDay(added) });

  await page.goto(`/contacts/${boris.id}`);
  const frequency = page.getByRole("group", { name: "Как часто общаться" });
  const pressed = (label: string) => frequency.getByRole("button", { name: label });
  await expect(pressed("Не задано")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/^(Следующий раз|Пора связаться) —/)).toBeHidden();

  // A month after the day he was added has passed: overdue at once
  await pressed("Раз в месяц").click();
  await expect(pressed("Раз в месяц")).toHaveAttribute("aria-pressed", "true");
  const overdue = `Пора связаться — ${formatOverdue(daysBetween(addMonths(added, 1), today()))}`;
  await expect(page.getByText(overdue)).toBeVisible();

  // Saved, not just shown
  await page.reload();
  await expect(pressed("Раз в месяц")).toHaveAttribute("aria-pressed", "true");
  const otherBrowser = await browser.newContext();
  try {
    const other = await otherBrowser.newPage();
    await other.goto(`/contacts/${boris.id}`);
    await expect(
      other
        .getByRole("group", { name: "Как часто общаться" })
        .getByRole("button", { name: "Раз в месяц" }),
    ).toHaveAttribute("aria-pressed", "true");
  } finally {
    await otherBrowser.close();
  }

  await pressed("Раз в год").click();
  await expect(
    page.getByText(`Следующий раз — до ${formatDay(addMonths(added, 12))}`),
  ).toBeVisible();
  await pressed("Раз в месяц").click();
  await expect(page.getByText(overdue)).toBeVisible();

  await page.getByRole("link", { name: "Все контакты" }).click();
  await expect(blockNames(page)).toHaveText(["Борис Петров"]);

  // The edit form has no frequency, and saving it keeps the frequency
  await page.goto(`/contacts/${boris.id}/edit`);
  await expect(page.getByRole("textbox", { name: "Имя" })).toBeVisible();
  await expect(page.getByText("Как часто общаться")).toBeHidden();
  await expect(page.getByRole("button", { name: "Раз в месяц" })).toBeHidden();
  await page.getByRole("textbox", { name: "Кто это" }).fill("Школьный друг");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Школьный друг")).toBeVisible();
  await expect(pressed("Раз в месяц")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(overdue)).toBeVisible();

  // «Не задано»: no due line, not in the block
  await pressed("Не задано").click();
  await expect(pressed("Не задано")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/^(Следующий раз|Пора связаться) —/)).toBeHidden();
  await page.getByRole("link", { name: "Все контакты" }).click();
  await expect(page.getByRole("table").getByRole("link")).toHaveText(["Борис Петров"]);
  await expect(block(page)).toBeHidden();
});

test("«Связались» in the block takes the contact out, «Отменить» brings it back", async ({
  page,
}) => {
  await addOverdue("Борис", 35, { about: "школьный друг" });
  await addOverdue("Анна", 13);
  await addOverdue("Вера", 10);
  await addOverdue("Глеб", 8);
  await addOverdue("Дарья", 5);
  await addOverdue("Егор", 3);
  await addOverdue("Жанна", 1);

  await page.goto("/");
  await expect(blockNames(page)).toHaveText(["Борис", "Анна", "Вера", "Глеб", "Дарья"]);
  await expect(block(page).getByText("7 контактов")).toBeVisible();
  const borisRow = block(page).getByRole("listitem").filter({ hasText: "Борис" });
  await expect(borisRow).toContainText("школьный друг");
  await expect(borisRow).toContainText("просрочено на 35 дней");

  await block(page).getByRole("button", { name: "Связались — Анна" }).click();
  await expect(page.getByText("Отмечено: Анна")).toBeVisible();
  await expect(blockNames(page)).toHaveText(["Борис", "Вера", "Глеб", "Дарья", "Егор"]);
  await expect(block(page).getByText("6 контактов")).toBeVisible();
  // Still on the home page, the card did not open
  await expect(page).toHaveURL("/");

  await page.getByRole("button", { name: "Отменить" }).click();
  await expect(page.getByText("Отмечено: Анна")).toBeHidden();
  await expect(blockNames(page)).toHaveText(["Борис", "Анна", "Вера", "Глеб", "Дарья"]);
  await expect(block(page).getByText("7 контактов")).toBeVisible();
  await expect(block(page).getByRole("listitem").filter({ hasText: "Анна" })).toContainText(
    "просрочено на 13 дней",
  );

  // The cross closes the message at once, the mark stays
  await block(page).getByRole("button", { name: "Связались — Анна" }).click();
  await expect(page.getByText("Отмечено: Анна")).toBeVisible();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect(page.getByText("Отмечено: Анна")).toBeHidden();
  await page.reload();
  await expect(blockNames(page)).toHaveText(["Борис", "Вера", "Глеб", "Дарья", "Егор"]);

  // The name opens the card
  await blockNames(page).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Борис" })).toBeVisible();
});

test("«Связались» at the last overdue contact leaves only the message, «Отменить» brings the block back", async ({
  page,
}) => {
  await addOverdue("Борис", 35);

  await page.goto("/");
  await expect(blockNames(page)).toHaveText(["Борис"]);

  await block(page).getByRole("button", { name: "Связались — Борис" }).click();
  await expect(page.getByText("Отмечено: Борис")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Пора связаться" })).toBeHidden();
  await expect(blockNames(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Отменить" }).click();
  await expect(page.getByText("Отмечено: Борис")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Пора связаться" })).toBeVisible();
  await expect(blockNames(page)).toHaveText(["Борис"]);
});

test("«Связались» in the card moves the due date, «Отменить» puts it back, the mark stays after the message", async ({
  page,
}) => {
  const lastContact = addDays(addMonths(today(), -12), -35);
  const boris = await addContact("Борис", {
    contactFrequency: "year",
    createdAt: onDay(lastContact),
  });
  const overdue = `Пора связаться — ${formatOverdue(daysBetween(addMonths(lastContact, 12), today()))}`;
  const nextTime = `Следующий раз — до ${formatDay(addMonths(today(), 12))}`;
  const lastContacted = `Последний раз связались: ${formatDay(today())}`;
  const notice = page.getByText("Отмечено: Борис");

  await page.goto(`/contacts/${boris.id}`);
  await expect(page.getByText(overdue)).toBeVisible();
  await expect(page.getByText(/^Последний раз связались/)).toBeHidden();

  await page.getByRole("button", { name: "Связались" }).click();
  await expect(notice).toBeVisible();
  await expect(page.getByText(nextTime)).toBeVisible();
  await expect(page.getByText(lastContacted)).toBeVisible();

  await page.getByRole("button", { name: "Отменить" }).click();
  await expect(notice).toBeHidden();
  await expect(page.getByText(overdue)).toBeVisible();
  await expect(page.getByText(/^Последний раз связались/)).toBeHidden();

  // Left alone, the message goes away in 8 seconds and the mark stays
  await page.getByRole("button", { name: "Связались" }).click();
  await expect(notice).toBeVisible();
  await expect(notice).toBeHidden({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByText(nextTime)).toBeVisible();
  await expect(page.getByText(lastContacted)).toBeVisible();
  // «Связались» is not a note
  await expect(page.getByText("Заметок пока нет.", { exact: false })).toBeVisible();

  await page.getByRole("link", { name: "Все контакты" }).click();
  await expect(page.getByRole("table").getByRole("link")).toHaveText(["Борис"]);
  await expect(block(page)).toBeHidden();
});

test("a note to an overdue contact moves the due date and takes it out of the block", async ({
  page,
}) => {
  await addOverdue("Борис", 5);

  await page.goto("/");
  await blockNames(page).first().click();
  await expect(page.getByText("Пора связаться — просрочено на 5 дней")).toBeVisible();

  await page.getByRole("textbox", { name: "Новая заметка" }).fill("Созвонились, всё хорошо");
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(
    page.getByText(`Следующий раз — до ${formatDay(addDays(today(), 7))}`),
  ).toBeVisible();

  await page.getByRole("link", { name: "Все контакты" }).click();
  await expect(page.getByRole("table").getByRole("link")).toHaveText(["Борис"]);
  await expect(block(page)).toBeHidden();
});

test("the block shows the five most overdue, all of them on request, only the chosen group, nothing while searching", async ({
  page,
}) => {
  const tennis = await addGroup("Теннис");
  const family = await addGroup("Семья");
  const work = await addGroup("Работа");
  // The later in the alphabet, the more overdue: the order comes from the days, not the names
  const tennisNames = ["Анна", "Борис", "Вера", "Глеб", "Дарья", "Егор", "Жанна", "Зоя"];
  const familyNames = ["Игорь", "Кира", "Лев", "Мария"];
  for (const [index, name] of [...tennisNames, ...familyNames].entries()) {
    const contact = await addOverdue(name, 5 + index * 2);
    await addToGroup(contact.id, tennisNames.includes(name) ? tennis.id : family.id);
  }
  // Nobody overdue in "Работа"
  const oleg = await addContact("Олег");
  await addToGroup(oleg.id, work.id);

  const allOverdue = [...tennisNames, ...familyNames].reverse();
  const tennisOverdue = [...tennisNames].reverse();
  const groupsRow = page.getByRole("navigation", { name: "Группы" });

  await page.goto("/");
  await expect(blockNames(page)).toHaveText(allOverdue.slice(0, 5));
  await expect(block(page).getByText("12 контактов")).toBeVisible();

  await page.getByRole("button", { name: "Показать всех" }).click();
  await expect(blockNames(page)).toHaveText(allOverdue);
  await page.getByRole("button", { name: "Свернуть" }).click();
  await expect(blockNames(page)).toHaveText(allOverdue.slice(0, 5));
  await expect(page.getByRole("button", { name: "Показать всех" })).toBeVisible();

  // Only the group's overdue contacts, counted by the group; expanding keeps the group
  await groupsRow.getByRole("link", { name: "Теннис" }).click();
  await expect(blockNames(page)).toHaveText(tennisOverdue.slice(0, 5));
  await expect(block(page).getByText("8 контактов")).toBeVisible();
  await page.getByRole("button", { name: "Показать всех" }).click();
  await expect(blockNames(page)).toHaveText(tennisOverdue);
  await expect(groupsRow.getByRole("link", { name: "Теннис" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await page.getByRole("button", { name: "Свернуть" }).click();
  await expect(blockNames(page)).toHaveText(tennisOverdue.slice(0, 5));
  await expect(groupsRow.getByRole("link", { name: "Теннис" })).toHaveAttribute(
    "aria-current",
    "true",
  );

  await groupsRow.getByRole("link", { name: "Работа" }).click();
  await expect(page.getByRole("table").getByRole("link")).toHaveText(["Олег"]);
  await expect(block(page)).toBeHidden();

  await groupsRow.getByRole("link", { name: "Все" }).click();
  await expect(blockNames(page)).toHaveText(allOverdue.slice(0, 5));
  await expect(block(page).getByText("12 контактов")).toBeVisible();

  // While searching only the results are shown
  await page.getByRole("searchbox").fill("Мария");
  await expect(page.getByRole("table").getByRole("link")).toHaveText(["Мария"]);
  await expect(block(page)).toBeHidden();
  await page.getByRole("searchbox").fill("");
  await expect(blockNames(page)).toHaveText(allOverdue.slice(0, 5));
});

test("on a narrow phone the overdue days stay clear of «Связались»", async ({ page }) => {
  await addOverdue("Буонконте да Монтефельтро", 125, {
    about: "Гибеллин, павший при Кампальдино",
  });

  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const days = block(page).getByText(formatOverdue(125));
    const button = block(page).getByRole("button", {
      name: "Связались — Буонконте да Монтефельтро",
    });
    await expect(days).toBeVisible();

    const daysBox = (await days.boundingBox())!;
    const buttonBox = (await button.boundingBox())!;
    // Soft: one run reports every width where the days run under the button
    expect.soft(daysBox.x + daysBox.width, `at ${width}px`).toBeLessThanOrEqual(buttonBox.x);
  }
});
