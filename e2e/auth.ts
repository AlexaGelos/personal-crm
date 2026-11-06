// Real login for the tests, with no faked session: ask for a link on the login page, take it
// from the Mailpit stand-in, open it. The same steps a person takes
import { expect, type Page } from "@playwright/test";

import { DEFAULT_USER_EMAIL } from "./database";
import { deleteMessagesTo, latestLoginLink } from "./mailpit";

// Types the address into the login form and presses «Получить ссылку»
export async function requestLink(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Почта").fill(email);
  await page.getByRole("button", { name: "Получить ссылку" }).click();
}

// The newest login link sent to the address; the old emails are removed first by
// forgetEmails(), so a test does not take a link of an earlier request
export async function forgetEmails(email: string) {
  await deleteMessagesTo(email);
}

// Logs in as the address (the default user unless named) and waits for the home page
export async function signIn(page: Page, email = DEFAULT_USER_EMAIL) {
  await forgetEmails(email);
  await requestLink(page, email);
  await expect(page.getByText(`Ссылка для входа отправлена на ${email}`)).toBeVisible();

  await page.goto(await latestLoginLink(email));
  await expect(page).toHaveURL("/");
  await expect(page.getByText(email, { exact: true })).toBeVisible();
}
