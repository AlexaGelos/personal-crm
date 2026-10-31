// The contact list fits the screen at any width: long names, "Кто это", emails and groups
// never push the table past its frame, so there is no sideways scrollbar
import { expect, test } from "@playwright/test";

import { addContact, addGroup, addToGroup, clearDatabase, closeDatabase } from "./database";

test.beforeEach(async () => {
  await clearDatabase();
});

test.afterAll(async () => {
  await closeDatabase();
});

test("the list has no sideways scrollbar on a small phone, a tablet and a computer", async ({
  page,
}) => {
  // The longest name and email among the contacts on the server
  const contact = await addContact("Буонконте да Монтефельтро", {
    about: "Гибеллин, павший при Кампальдино, спасён в последний миг одной слезинкой раскаяния",
    phone: "+7 982 803-80-95",
    email: "svetlana.shcherbakova@outlook.com",
  });
  for (const name of ["Флорентийцы", "Чистилище", "Гибеллины", "Поэты"]) {
    const group = await addGroup(name);
    await addToGroup(contact.id, group.id);
  }

  for (const width of [320, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const table = page.getByRole("table");
    await expect(table.getByRole("link", { name: "Буонконте да Монтефельтро" })).toBeVisible();

    // How far the table sticks out of its frame
    const overflow = await table.evaluate((element) => {
      const frame = element.parentElement!;
      return frame.scrollWidth - frame.clientWidth;
    });
    // Soft: one run reports every width that scrolls
    expect.soft(overflow, `at ${width}px`).toBe(0);
  }
});
