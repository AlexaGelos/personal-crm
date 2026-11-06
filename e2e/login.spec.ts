// Login by a link from an email, on a real database and the Mailpit stand-in: who gets in, what
// the link does, how long it lives, how many emails may be asked for, the header, the exit.
// Time is moved in the database (e2e/database.ts), not waited for
import { expect, test, type Page } from "@playwright/test";

import { forgetEmails, requestLink, signIn } from "./auth";
import {
  addContact,
  ageEmailLog,
  clearDatabase,
  closeDatabase,
  DEFAULT_USER_EMAIL,
  liveLinksOf,
  sessionsOf,
  setLinkTerm,
  setSessionTerm,
  usersWithEmail,
} from "./database";
import {
  deleteMessagesTo,
  latestLoginLink,
  messagesTo,
  uniqueAddress,
  waitForMessages,
} from "./mailpit";

const LINK_EXPIRED = "Ссылка устарела";
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

test.beforeEach(async () => {
  await clearDatabase();
});

test.afterAll(async () => {
  await closeDatabase();
});

// An address nobody else uses, with its mailbox emptied when the test is over
const used: string[] = [];
function address(prefix = "anna") {
  const email = uniqueAddress(prefix);
  used.push(email);
  return email;
}

test.afterEach(async () => {
  await Promise.all(used.splice(0).map(deleteMessagesTo));
});

// Asks for a link for the address and gives it, without opening it
async function askForLink(page: Page, email: string) {
  await requestLink(page, email);
  await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible();
  const messages = await waitForMessages(email, (await messagesTo(email)).length || 1);
  return latestLoginLink(email).then((link) => ({ link, count: messages.length }));
}

async function logOut(page: Page) {
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL("/login");
}

test.describe("the app is closed without a login", () => {
  test("the home page shows the login page", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/login");
    await expect(page.getByLabel("Почта")).toBeVisible();
    await expect(page.getByRole("button", { name: "Получить ссылку" })).toBeVisible();
  });

  test("a direct address of a card, a form or the groups shows the login page, not the data", async ({
    page,
  }) => {
    const contact = await addContact("Анна Закрытая");

    for (const path of [
      `/contacts/${contact.id}`,
      `/contacts/${contact.id}/edit`,
      "/contacts/new",
      "/groups",
    ]) {
      await page.goto(path);
      await expect(page, path).toHaveURL("/login");
      await expect(page.getByText("Анна Закрытая"), path).toBeHidden();
    }
  });

  test("a request to change data without a login changes nothing and leads to the login page", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/contacts/new");
    await page.getByLabel("Имя").fill("Борис Лишний");
    // The login ends while the form is open: the same as a tab left open for a month
    await setSessionTerm(DEFAULT_USER_EMAIL, new Date(Date.now() - MINUTE_MS));

    await page.getByRole("button", { name: "Добавить контакт" }).click();

    await expect(page).toHaveURL("/login");
    await page.context().clearCookies();
    await signIn(page);
    await expect(page.getByText("Борис Лишний")).toBeHidden();
    await expect(page.getByText("Пока нет ни одного контакта")).toBeVisible();
  });

  test("/health answers without a login", async ({ request }) => {
    const response = await request.get("/health");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("the picture for link previews and the cursors are served without a login", async ({
    request,
  }) => {
    const picture = await request.get("/opengraph-image.jpg");
    const cursor = await request.get("/cursors/arrow.svg");

    expect(picture.status()).toBe(200);
    expect(picture.headers()["content-type"]).toContain("image/jpeg");
    expect(cursor.status()).toBe(200);
  });

  test("the login page of someone who is already in leads to their contacts", async ({ page }) => {
    await addContact("Анна Своя");
    await signIn(page);

    await page.goto("/login");

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("link", { name: "Анна Своя" })).toBeVisible();
  });
});

test.describe("asking for a link", () => {
  test("an address nobody has used gets the link", async ({ page }) => {
    const email = address();

    await requestLink(page, email);

    await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible();
    expect(await waitForMessages(email)).toHaveLength(1);
  });

  test("a known address gets the same message and the link", async ({ page }) => {
    await forgetEmails(DEFAULT_USER_EMAIL);

    await requestLink(page, DEFAULT_USER_EMAIL);

    await expect(
      page.getByText(`Ссылка для входа отправлена на ${DEFAULT_USER_EMAIL}`),
    ).toBeVisible();
    expect(await waitForMessages(DEFAULT_USER_EMAIL)).toHaveLength(1);
  });

  test("spaces and capital letters are dropped from the address", async ({ page }) => {
    const email = address();

    await requestLink(page, `  ${email.toUpperCase()}  `);

    await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible();
    expect(await waitForMessages(email)).toHaveLength(1);
  });

  test("a wrong address and an empty field give an error and no email", async ({ page }) => {
    const email = address();
    const typo = email.split("@")[0] + "@";

    for (const typed of [typo, "", "   "]) {
      await requestLink(page, typed);
      await expect(page.getByText("Проверь адрес почты"), `"${typed}"`).toBeVisible();
    }

    expect(await messagesTo(email)).toEqual([]);
  });

  test("a request that bypasses the page finds no such address, and no email goes out", async ({
    request,
  }) => {
    const email = address();

    const response = await request.post("/api/auth/sign-in/magic-link", { data: { email } });

    expect(response.status()).toBe(404);
    expect(await messagesTo(email)).toEqual([]);
  });

  test("the fourth email in 10 minutes is refused, the third link still works", async ({
    page,
  }) => {
    const email = address();
    for (let i = 0; i < 3; i++) {
      await requestLink(page, email);
      await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible();
    }
    const thirdLink = await latestLoginLink(email);

    await requestLink(page, email);
    await expect(page.getByText("Слишком часто, попробуй через несколько минут")).toBeVisible();
    expect(await messagesTo(email)).toHaveLength(3);

    await page.goto(thirdLink);
    await expect(page).toHaveURL("/");
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  });

  test("after 10 minutes the email is sent again", async ({ page }) => {
    const email = address();
    for (let i = 0; i < 3; i++) {
      await requestLink(page, email);
      await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible();
    }
    await ageEmailLog(email, 11);

    await requestLink(page, email);

    await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible();
    expect(await waitForMessages(email, 4)).toHaveLength(4);
  });

  test("the limit of one address does not stop another one, and capital letters do not get round it", async ({
    page,
  }) => {
    const anna = address("anna");
    const boris = address("boris");
    for (let i = 0; i < 3; i++) {
      await requestLink(page, anna);
      await expect(page.getByText(`Ссылка для входа отправлена на ${anna}`)).toBeVisible();
    }

    await requestLink(page, boris);
    await expect(page.getByText(`Ссылка для входа отправлена на ${boris}`)).toBeVisible();

    await requestLink(page, ` ${anna.toUpperCase()} `);
    await expect(page.getByText("Слишком часто, попробуй через несколько минут")).toBeVisible();
  });
});

test.describe("the link from the email", () => {
  test("the first login makes the user and shows the home page with their email", async ({
    page,
  }) => {
    const email = address();
    expect(await usersWithEmail(email)).toHaveLength(0);

    const { link } = await askForLink(page, email);
    await page.goto(link);

    await expect(page).toHaveURL("/");
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    expect(await usersWithEmail(email)).toHaveLength(1);
  });

  test("a second login is the same user with the same contacts", async ({ page }) => {
    await addContact("Анна Прежняя");
    await signIn(page);
    await logOut(page);

    await signIn(page);

    await expect(page.getByRole("link", { name: "Анна Прежняя" })).toBeVisible();
    expect(await usersWithEmail(DEFAULT_USER_EMAIL)).toHaveLength(1);
  });

  test("the same address in other letters is the same user", async ({ page }) => {
    await addContact("Анна Прежняя");
    await signIn(page);
    await logOut(page);
    await forgetEmails(DEFAULT_USER_EMAIL);

    await requestLink(page, DEFAULT_USER_EMAIL.toUpperCase());
    await expect(
      page.getByText(`Ссылка для входа отправлена на ${DEFAULT_USER_EMAIL}`),
    ).toBeVisible();
    await page.goto(await latestLoginLink(DEFAULT_USER_EMAIL));

    await expect(page.getByRole("link", { name: "Анна Прежняя" })).toBeVisible();
    expect(await usersWithEmail(DEFAULT_USER_EMAIL)).toHaveLength(1);
  });

  test("a link of another user in the same browser logs in as them", async ({ page, browser }) => {
    const boris = address("boris");
    await addContact("Анна Первая");
    await signIn(page);
    // Whoever is in cannot reach the login form in this browser: ask for the link in another one
    const other = await (await browser.newContext()).newPage();
    const { link } = await askForLink(other, boris);
    await other.context().close();

    await page.goto(link);

    await expect(page.getByText(boris, { exact: true })).toBeVisible();
    await expect(page.getByText(DEFAULT_USER_EMAIL, { exact: true })).toBeHidden();
    await expect(page.getByRole("link", { name: "Анна Первая" })).toBeHidden();
  });

  test("a link opened a second time does not let in", async ({ page }) => {
    const email = address();
    const { link } = await askForLink(page, email);
    await page.goto(link);
    await expect(page).toHaveURL("/");
    await logOut(page);

    await page.goto(link);

    await expect(page.getByText(LINK_EXPIRED)).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("a link older than 15 minutes does not let in", async ({ page }) => {
    const email = address();
    const { link } = await askForLink(page, email);
    await setLinkTerm(email, new Date(Date.now() - MINUTE_MS));

    await page.goto(link);

    await expect(page.getByText(LINK_EXPIRED)).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("a link of 14 minutes ago still lets in", async ({ page }) => {
    const email = address();
    const { link } = await askForLink(page, email);
    // Made 14 minutes ago: one minute of the 15 is left
    await setLinkTerm(email, new Date(Date.now() + MINUTE_MS));

    await page.goto(link);

    await expect(page).toHaveURL("/");
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  });

  test("a new link switches off the old one", async ({ page }) => {
    const email = address();
    const first = await askForLink(page, email);
    await requestLink(page, email);
    await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible();
    await waitForMessages(email, 2);
    const second = await latestLoginLink(email);
    expect(second).not.toBe(first.link);

    await page.goto(first.link);
    await expect(page.getByText(LINK_EXPIRED)).toBeVisible();

    await page.goto(second);
    await expect(page).toHaveURL("/");
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  });

  test("a link of another address is not switched off", async ({ page }) => {
    const anna = address("anna");
    const boris = address("boris");
    const { link: annaLink } = await askForLink(page, anna);
    await askForLink(page, boris);
    expect(await liveLinksOf(anna)).toHaveLength(1);

    await page.goto(annaLink);

    await expect(page).toHaveURL("/");
    await expect(page.getByText(anna, { exact: true })).toBeVisible();
  });

  test("a made-up link leads to the page of an expired link", async ({ page }) => {
    await page.goto("/api/auth/magic-link/verify?token=made-up-token-that-nobody-issued");

    await expect(page.getByText(LINK_EXPIRED)).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("an address of the link with no token leads there too", async ({ page }) => {
    await page.goto("/api/auth/magic-link/verify");

    await expect(page.getByText(LINK_EXPIRED)).toBeVisible();
  });

  test("the button on the page of an expired link leads to the login page", async ({ page }) => {
    await page.goto("/api/auth/magic-link/verify?token=made-up-token-that-nobody-issued");

    await page.getByRole("link", { name: "На страницу входа" }).click();

    await expect(page).toHaveURL("/login");
    await expect(page.getByLabel("Почта")).toBeVisible();
  });
});

test.describe("the email and the stand-in for the mail service", () => {
  test("the button in the email leads to this very app", async ({ page, baseURL }) => {
    const email = address();
    const { link } = await askForLink(page, email);

    expect(link.startsWith(`${baseURL}/`)).toBe(true);
    const [message] = await waitForMessages(email);
    expect(message.from.name).toBe("Личная CRM");
    expect(message.subject).toBe("Вход в Личную CRM");
    await page.goto(link);
    await expect(page).toHaveURL("/");
  });

  test("the email can be read on the page of the stand-in", async ({ page }) => {
    const email = address();
    await askForLink(page, email);

    await page.goto(`http://127.0.0.1:8025/search?q=${encodeURIComponent(`to:${email}`)}`);

    await expect(page.getByText("Вход в Личную CRM").first()).toBeVisible();
  });

  test("two made-up addresses give two different users", async ({ browser }) => {
    const [anna, boris] = [address("anna"), address("boris")];
    const first = await (await browser.newContext()).newPage();
    const second = await (await browser.newContext()).newPage();

    for (const [page, email] of [
      [first, anna],
      [second, boris],
    ] as const) {
      const { link } = await askForLink(page, email);
      await page.goto(link);
      await expect(page.getByText(email, { exact: true })).toBeVisible();
    }

    expect(await usersWithEmail(anna)).toHaveLength(1);
    expect(await usersWithEmail(boris)).toHaveLength(1);
    await first.context().close();
    await second.context().close();
  });
});

test.describe("how long the login lasts", () => {
  test("a visit renews the login for 30 days, on the server and in the browser", async ({
    page,
  }) => {
    await signIn(page);
    // The last visit was 29 days ago: a day of the term is left
    await setSessionTerm(DEFAULT_USER_EMAIL, new Date(Date.now() + DAY_MS));

    await page.goto("/");

    await expect(page.getByText(DEFAULT_USER_EMAIL, { exact: true })).toBeVisible();
    const [session] = await sessionsOf(DEFAULT_USER_EMAIL);
    const daysLeft = (session.expiresAt.getTime() - Date.now()) / DAY_MS;
    expect(daysLeft).toBeGreaterThan(29.9);
    expect(daysLeft).toBeLessThanOrEqual(30);

    const cookie = (await page.context().cookies()).find((c) => c.name.endsWith("session_token"));
    const cookieDaysLeft = (cookie!.expires * 1000 - Date.now()) / DAY_MS;
    expect(cookieDaysLeft).toBeGreaterThan(29.9);
    expect(cookieDaysLeft).toBeLessThanOrEqual(30);
  });

  test("after 30 days without a visit the login page is shown", async ({ page }) => {
    await signIn(page);
    await setSessionTerm(DEFAULT_USER_EMAIL, new Date(Date.now() - MINUTE_MS));

    await page.goto("/");

    await expect(page).toHaveURL("/login");
  });

  test("two browsers can be in at once and see the same contacts", async ({ page, browser }) => {
    await addContact("Анна Общая");
    await signIn(page);
    const other = await (await browser.newContext()).newPage();
    await signIn(other);

    for (const tab of [page, other]) {
      await tab.goto("/");
      await expect(tab.getByRole("link", { name: "Анна Общая" })).toBeVisible();
    }
    await other.context().close();
  });
});

test.describe("the email and «Выйти» in the header", () => {
  test("are on every page after the login", async ({ page }) => {
    const contact = await addContact("Анна Видимая");
    await signIn(page);

    for (const path of ["/", "/groups", "/contacts/new", `/contacts/${contact.id}`]) {
      await page.goto(path);
      await expect(page.getByText(DEFAULT_USER_EMAIL, { exact: true }), path).toBeVisible();
      await expect(page.getByRole("button", { name: "Выйти" }), path).toBeVisible();
    }
  });

  test("are not on the login page", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByLabel("Почта")).toBeVisible();
    await expect(page.getByRole("button", { name: "Выйти" })).toBeHidden();
  });

  test("«Выйти» ends the login: the login page now, and again on the home page", async ({
    page,
  }) => {
    await signIn(page);

    await logOut(page);
    await page.goto("/");

    await expect(page).toHaveURL("/login");
    expect(await sessionsOf(DEFAULT_USER_EMAIL)).toHaveLength(0);
  });

  test("«Выйти» in one browser leaves the other browser in", async ({ page, browser }) => {
    await signIn(page);
    const other = await (await browser.newContext()).newPage();
    await signIn(other);

    await logOut(page);

    await other.goto("/");
    await expect(other.getByText(DEFAULT_USER_EMAIL, { exact: true })).toBeVisible();
    await other.context().close();
  });

  test("a long address on a phone is cut short: no sideways scroll, «Выйти» can be pressed", async ({
    page,
  }) => {
    const email = `${"a".repeat(40)}.${"b".repeat(7)}@example.com`;
    expect(email.length).toBe(60);
    await signIn(page, email);

    // Also with the text drawn 10% wider, as it is on Linux in CI
    for (const fontScale of ["100%", "110%"]) {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto("/");
      await page.addStyleTag({ content: `html { font-size: ${fontScale}; }` });

      const shown = page.getByText(email, { exact: true });
      await expect(shown, fontScale).toBeVisible();
      const sideways = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(sideways, `sideways scroll at ${fontScale}`).toBe(0);

      // Cut with "…": the text is wider than its box
      const cut = await shown.evaluate((element) => element.scrollWidth > element.clientWidth);
      expect(cut, `the address is cut at ${fontScale}`).toBe(true);

      const button = page.getByRole("button", { name: "Выйти" });
      const box = await button.boundingBox();
      expect(box!.height, fontScale).toBeGreaterThanOrEqual(44);
      expect(box!.x + box!.width, fontScale).toBeLessThanOrEqual(320);
      await expect(button).toBeInViewport();
    }

    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page).toHaveURL("/login");
  });
});
