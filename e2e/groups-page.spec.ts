// The «Группы» page stays short with many groups: on a phone each group is one line, the name
// and then the pencil and the bin; on a wide screen the buttons say what they do
import { expect, test } from "@playwright/test";

import { addGroup, clearDatabase, closeDatabase } from "./database";
import { MANY_GROUPS } from "./groups";

test.beforeEach(async () => {
  await clearDatabase();
});

test.afterAll(async () => {
  await closeDatabase();
});

for (const width of [320, 390]) {
  test(`at ${width}px each group is one line: the name, then the pencil and the bin`, async ({
    page,
  }) => {
    for (const name of MANY_GROUPS) await addGroup(name);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/groups");
    await expect(page.getByRole("listitem")).toHaveCount(MANY_GROUPS.length);

    for (const name of MANY_GROUPS) {
      const nameBox = (await page.getByRole("link", { name, exact: true }).boundingBox())!;
      const buttons = [
        page.getByRole("link", { name: `Переименовать группу «${name}»` }),
        page.getByRole("button", { name: `Удалить группу «${name}»` }),
      ];
      for (const button of buttons) {
        const box = (await button.boundingBox())!;
        // Right of the name, not under it; a square the size of a finger
        expect(box.x, name).toBeGreaterThanOrEqual(nameBox.x + nameBox.width);
        expect(box.y, name).toBeLessThan(nameBox.y + nameBox.height);
        expect(Math.round(box.width), name).toBe(44);
        expect(Math.round(box.height), name).toBe(44);
      }
    }

    // No word of a name breaks in the middle: the longest one fits next to the buttons
    const brokenWords = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.cssText = "position: absolute; visibility: hidden; white-space: nowrap";
      document.body.append(probe);
      return [...document.querySelectorAll<HTMLElement>("li a[href^='/?group=']")].flatMap(
        (name) => {
          probe.className = name.className;
          return name.textContent!.split(" ").filter((word) => {
            probe.textContent = word;
            return probe.getBoundingClientRect().width > name.getBoundingClientRect().width;
          });
        },
      );
    });
    expect(brokenWords).toEqual([]);

    const sideScroll = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sideScroll).toBe(0);
  });
}

test("on a phone the pencil renames and the bin asks before deleting", async ({ page }) => {
  await addGroup("Ад");
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/groups");

  await page.getByRole("link", { name: "Переименовать группу «Ад»" }).click();
  await expect(page.getByRole("textbox", { name: "Название группы" })).toHaveValue("Ад");
  await page.getByRole("link", { name: "Отмена" }).click();

  await page.getByRole("button", { name: "Удалить группу «Ад»" }).click();
  await expect(page.getByRole("alertdialog", { name: "Удалить группу?" })).toBeVisible();
  await page.getByRole("button", { name: "Отмена" }).click();
  await expect(page.getByRole("link", { name: "Ад", exact: true })).toBeVisible();
});

test("on a computer the buttons have their words", async ({ page }) => {
  await addGroup("Ад");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/groups");

  for (const button of [
    page.getByRole("link", { name: "Переименовать группу «Ад»" }),
    page.getByRole("button", { name: "Удалить группу «Ад»" }),
  ]) {
    // Wide enough for the word, not a bare icon
    expect((await button.boundingBox())!.width).toBeGreaterThan(100);
  }
});
