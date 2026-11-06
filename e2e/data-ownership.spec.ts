// Whose data is whose, in a real browser with real logins: two people, A and B, in different
// browsers. Each sees and changes only their own contacts, groups and notes
import { expect, test, type Browser, type Page } from "@playwright/test";

import { signIn } from "./auth";
import {
  addContact,
  addGroup,
  addNotes,
  addToGroup,
  addUser,
  clearDatabase,
  closeDatabase,
  usersWithEmail,
} from "./database";
import { deleteMessagesTo, uniqueAddress } from "./mailpit";

const A = uniqueAddress("anna");
const B = uniqueAddress("boris");

test.beforeEach(async () => {
  await clearDatabase();
});

test.afterAll(async () => {
  await closeDatabase();
});

test.afterEach(async () => {
  await Promise.all([A, B].map(deleteMessagesTo));
});

// A person in a browser of their own: a new window with its own cookies, logged in
async function personIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, email);
  return page;
}

function listedNames(page: Page) {
  return page.getByRole("table").getByRole("link");
}

const NOT_FOUND = "Контакт не найден";

test("two people: A adds a contact, B sees nothing of it, A still does", async ({ browser }) => {
  const a = await personIn(browser, A);

  // A adds a contact in the form, as a person does
  await a.goto("/contacts/new");
  await a.getByLabel("Имя").fill("Анна Закрытая");
  await a.getByRole("button", { name: "Добавить контакт" }).click();
  await expect(a.getByRole("heading", { level: 1, name: "Анна Закрытая" })).toBeVisible();
  const cardPath = new URL(a.url()).pathname;

  // B has a contact of their own, so that the search has something to look through
  const boris = await addUser(B);
  await addContact("Борис Свой", { userId: boris.id });
  const b = await personIn(browser, B);

  // Not in the list and not in the search
  await b.goto("/");
  await expect(listedNames(b)).toHaveText(["Борис Свой"]);
  await expect(b.getByText("Анна Закрытая")).toBeHidden();
  await b.getByRole("searchbox").fill("Анна");
  await expect(b.getByText("Никого не нашли по запросу «Анна»")).toBeVisible();

  // By the direct address of A's contact: the same as if there were none
  await b.goto(cardPath);
  await expect(b.getByRole("heading", { name: NOT_FOUND })).toBeVisible();
  await expect(b.getByRole("link", { name: "К списку контактов" })).toBeVisible();
  await expect(b.getByText("Анна Закрытая")).toBeHidden();
  await b.goto(`${cardPath}/edit`);
  await expect(b.getByRole("heading", { name: NOT_FOUND })).toBeVisible();

  await a.goto("/");
  await expect(listedNames(a)).toHaveText(["Анна Закрытая"]);
});

test("a contact that does not exist looks exactly like a contact of another person", async ({
  browser,
}) => {
  const a = await addUser(A);
  const annas = await addContact("Анна Чужая", { userId: a.id });
  const b = await personIn(browser, B);

  const text = async (path: string) => {
    await b.goto(path);
    await expect(b.getByRole("heading", { name: NOT_FOUND })).toBeVisible();
    return b.locator("main").innerText();
  };

  expect(await text(`/contacts/${annas.id}`)).toBe(await text("/contacts/999999"));
  expect(await text(`/contacts/${annas.id}/edit`)).toBe(await text("/contacts/999999/edit"));
});

test("the counters over the list, the search and «Пора связаться» count only your own", async ({
  browser,
}) => {
  const a = await addUser(A);
  const b = await addUser(B);
  for (const name of ["Анна Первая", "Борис Первый", "Вера Первая"]) {
    await addContact(name, { userId: a.id });
  }
  // A has someone to get in touch with long ago; B has not
  await addContact("Глеб Запущенный", {
    userId: a.id,
    contactFrequency: "week",
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
  });
  await addContact("Анна Вторая", { userId: b.id });
  await addContact("Дарья Вторая", { userId: b.id });

  const page = await personIn(browser, B);

  await expect(page.getByText("Всего 2 контакта")).toBeVisible();
  await expect(listedNames(page)).toHaveText(["Анна Вторая", "Дарья Вторая"]);
  await expect(page.getByRole("region", { name: "Пора связаться" })).toBeHidden();
  await expect(page.getByText("Глеб Запущенный")).toBeHidden();

  await page.getByRole("searchbox").fill("Анна");
  await expect(page.getByText("Найдено: 1 (всего 2 контакта)")).toBeVisible();
  await expect(listedNames(page)).toHaveText(["Анна Вторая"]);
});

test("the groups of A are nowhere in B's pages", async ({ browser }) => {
  const a = await addUser(A);
  const tennis = await addGroup("Теннис", a.id);
  const anna = await addContact("Анна Теннисная", { userId: a.id });
  await addToGroup(anna.id, tennis.id);
  const page = await personIn(browser, B);

  for (const path of ["/", "/groups", "/contacts/new"]) {
    await page.goto(path);
    await expect(page.getByRole("heading").first(), path).toBeVisible();
    // Whole words only: the empty page of groups gives «Теннис» as an example of a name
    await expect(page.getByText("Теннис", { exact: true }), path).toBeHidden();
  }

  // And A sees the group with the contact in the list and in the card
  const own = await personIn(browser, A);
  await expect(own.getByRole("navigation", { name: "Группы" }).getByText("Теннис")).toBeVisible();
  await own.getByRole("link", { name: "Анна Теннисная" }).click();
  // Only inside the card: the list stays in the page, hidden, with the group row
  const card = own.locator('[data-slot="card"]').filter({
    has: own.getByRole("heading", { level: 1, name: "Анна Теннисная" }),
  });
  await expect(card.getByRole("link", { name: "Теннис" })).toBeVisible();
});

test("a group address of A, opened by B, shows «Все» and the contacts of B", async ({
  browser,
}) => {
  const a = await addUser(A);
  const b = await addUser(B);
  const theirs = await addGroup("Теннис", a.id);
  await addGroup("Свои", b.id);
  await addContact("Борис Свой", { userId: b.id });
  const page = await personIn(browser, B);

  await page.goto(`/?group=${theirs.id}`);

  const row = page.getByRole("navigation", { name: "Группы" });
  await expect(row.getByRole("link", { name: "Все" })).toHaveAttribute("aria-current", "true");
  await expect(listedNames(page)).toHaveText(["Борис Свой"]);
  await expect(page.getByText("Теннис")).toBeHidden();
});

test("the address of a group opened in another browser by the same person shows the same group", async ({
  browser,
}) => {
  const a = await addUser(A);
  const tennis = await addGroup("Теннис", a.id);
  const anna = await addContact("Анна Теннисная", { userId: a.id });
  await addContact("Борис Другой", { userId: a.id });
  await addToGroup(anna.id, tennis.id);
  const first = await personIn(browser, A);
  await first.goto(`/?group=${tennis.id}`);
  const second = await personIn(browser, A);

  await second.goto(`/?group=${tennis.id}`);

  const row = second.getByRole("navigation", { name: "Группы" });
  await expect(row.getByRole("link", { name: "Теннис" })).toHaveAttribute("aria-current", "true");
  await expect(listedNames(second)).toHaveText(["Анна Теннисная"]);
});

test("a person who logs in for the first time sees an empty list, though others have data", async ({
  browser,
}) => {
  const a = await addUser(A);
  await addContact("Анна Закрытая", {
    userId: a.id,
    contactFrequency: "week",
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
  });
  await addGroup("Теннис", a.id);

  const page = await personIn(browser, B);

  await expect(page.getByText("Пока нет ни одного контакта")).toBeVisible();
  await expect(page.getByText("Добавь первый контакт")).toBeVisible();
  await expect(page.getByRole("link", { name: "Создать группу" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Группы" })).toBeHidden();
  await expect(page.getByRole("region", { name: "Пора связаться" })).toBeHidden();
});

test("two people can have a group with the same name, each with their own contacts", async ({
  browser,
}) => {
  const a = await addUser(A);
  const friends = await addGroup("Друзья", a.id);
  const anna = await addContact("Анна Друг", { userId: a.id });
  await addToGroup(anna.id, friends.id);
  const page = await personIn(browser, B);

  await page.goto("/groups");
  await page.getByPlaceholder("Новая группа").fill("друзья");
  await page.getByRole("button", { name: "Создать" }).click();

  await expect(page.getByRole("link", { name: "друзья", exact: true })).toBeVisible();
  await expect(page.getByText("Такая группа уже есть")).toBeHidden();
  await expect(page.getByText("0 контактов")).toBeVisible();

  // The group of A is as it was, with its contact
  const own = await personIn(browser, A);
  await own.goto("/groups");
  await expect(own.getByText("1 контакт", { exact: true })).toBeVisible();
});

test("the owner, who has the data from before the login, logs in and sees all of it", async ({
  browser,
}) => {
  // What the migration leaves behind: one user with contacts, notes and groups
  const owner = await addUser(A);
  const family = await addGroup("Семья", owner.id);
  const anna = await addContact("Анна Прежняя", { userId: owner.id });
  await addContact("Борис Прежний", { userId: owner.id });
  await addToGroup(anna.id, family.id);
  await addNotes(anna.id, ["Обсудили отпуск", "Позвонила сама"]);

  const page = await personIn(browser, A);

  await expect(listedNames(page)).toHaveText(["Анна Прежняя", "Борис Прежний"]);
  await expect(page.getByRole("navigation", { name: "Группы" }).getByText("Семья")).toBeVisible();
  await page.getByRole("link", { name: "Анна Прежняя" }).click();
  await expect(page.getByText("Обсудили отпуск")).toBeVisible();
  await expect(page.getByText("Позвонила сама")).toBeVisible();
  expect(await usersWithEmail(A)).toHaveLength(1);
});
