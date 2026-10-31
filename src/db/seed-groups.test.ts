import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { contactGroups, groups } from "@/db/schema";
import { addContact, addGroup, addToGroup } from "@/test/helpers";
import {
  CHARACTERS,
  GROUP_RULES as DANTE_RULES,
  GROUPS_MARKER as DANTE_MARKER,
  groupsFor as danteGroupsFor,
  REALM_RULES,
} from "./seed-dante-data";
import { GROUPS_MARKER, groupsFor, HOW_WE_MET } from "./seed-data";
import { addSeedGroups } from "./seed-tools";

const contact = (fields: { name?: string; about?: string; howWeMet?: string }) => ({
  name: fields.name ?? "Анна Иванова",
  about: fields.about ?? null,
  howWeMet: fields.howWeMet ?? null,
});

describe("groupsFor, the test contacts", () => {
  it("puts a contact into every group that fits", () => {
    const found = groupsFor(
      contact({ about: "Бывший коллега", howWeMet: "Познакомились в спортзале" }),
    );
    expect(found).toEqual(expect.arrayContaining(["Работа", "Спорт"]));
  });

  it("does not take a head of sales for a former boss", () => {
    expect(groupsFor(contact({ about: "Руководитель отдела продаж" }))).not.toContain("Работа");
  });

  it("puts the neighbours at the dacha among the neighbours", () => {
    expect(groupsFor(contact({ about: "Сосед по даче" }))).toEqual(["Соседи"]);
  });

  it("finds a group for every way of meeting", () => {
    for (const howWeMet of HOW_WE_MET) {
      expect(groupsFor(contact({ howWeMet })), howWeMet).not.toEqual([]);
    }
  });

  it("gives contacts to the marker group", () => {
    const found = groupsFor(contact({ howWeMet: "Познакомились на конференции в Казани" }));
    expect(found).toContain(GROUPS_MARKER);
  });
});

describe("groupsFor, the Divine Comedy contacts", () => {
  it("knows the heroes by name", () => {
    const found = danteGroupsFor(contact({ name: "Харон", about: "Перевозчик через Ахерон" }));
    expect(found).toEqual(expect.arrayContaining(["Ад", "Стражи", "Античность"]));
  });

  it("tells the city of a made-up Florentine by the family", () => {
    const found = danteGroupsFor(
      contact({ name: "Гвидо Толомеи", about: "Астролог, составляет гороскопы для подесты" }),
    );
    expect(found).toContain("Сиенцы");
    expect(found).not.toContain("Флорентийцы");
    expect(danteGroupsFor(contact({ name: "Гвидо Донати" }))).toContain("Флорентийцы");
  });

  it("takes the realm from «Кто это» first, from where we met only when it says nothing", () => {
    const moon = danteGroupsFor(
      contact({
        name: "Лапа Черки",
        about: "Обитательница неба Луны, не исполнила обет",
        howWeMet: "Застряли рядом во льду Коцита",
      }),
    );
    expect(moon).toContain("Рай");
    expect(moon).not.toContain("Ад");

    const notary = danteGroupsFor(
      contact({
        name: "Лапо Черки",
        about: "Нотариус, белый гвельф",
        howWeMet: "Застряли рядом во льду Коцита",
      }),
    );
    expect(notary).toContain("Ад");
  });

  it("gives contacts to the marker group", () => {
    const [{ name, about, howWeMet }] = CHARACTERS;
    expect(danteGroupsFor(contact({ name, about, howWeMet }))).toContain(DANTE_MARKER);
  });

  it("names only heroes that are in the poem", () => {
    const heroes = new Set(CHARACTERS.map((character) => character.name));
    for (const rule of [...DANTE_RULES, ...REALM_RULES]) {
      for (const name of rule.names ?? []) expect(heroes, `${rule.group}: ${name}`).toContain(name);
    }
  });
});

describe("addSeedGroups", () => {
  const groupNames = async () =>
    (await db.select({ name: groups.name }).from(groups)).map((group) => group.name).sort();

  const groupsOf = async (contactId: number) =>
    (
      await db
        .select({ name: groups.name })
        .from(contactGroups)
        .innerJoin(groups, eq(groups.id, contactGroups.groupId))
        .where(eq(contactGroups.contactId, contactId))
    )
      .map((group) => group.name)
      .sort();

  it("puts only its own contacts into groups and makes no empty groups", async () => {
    const ours = await addContact("Харон", { about: "Перевозчик" });
    // Same name, but the owner changed «Кто это»: not a test contact any more
    const changed = await addContact("Минос", { about: "Мой судья" });

    const result = await addSeedGroups(db, {
      marker: "Стражи",
      seeded: [
        { name: "Харон", about: "Перевозчик" },
        { name: "Минос", about: "Судья" },
      ],
      groupsFor: ({ name }) => (name === "Харон" ? ["Стражи"] : ["Судьи"]),
    });

    expect(result).toEqual({ groupCount: 1, linkCount: 1 });
    expect(await groupNames()).toEqual(["Стражи"]);
    expect(await groupsOf(ours.id)).toEqual(["Стражи"]);
    expect(await groupsOf(changed.id)).toEqual([]);
  });

  it("uses the group the owner already has under that name", async () => {
    const charon = await addContact("Харон", { about: "Перевозчик" });
    await addGroup("стражи");

    await addSeedGroups(db, {
      marker: "Античность",
      seeded: [{ name: "Харон", about: "Перевозчик" }],
      groupsFor: () => ["Стражи", "Античность"],
    });

    expect(await groupNames()).toEqual(["Античность", "стражи"]);
    expect(await groupsOf(charon.id)).toEqual(["Античность", "стражи"]);
  });

  it("keeps the groups a contact is already in", async () => {
    const charon = await addContact("Харон", { about: "Перевозчик" });
    const own = await addGroup("Лодочники");
    await addToGroup(charon.id, own.id);

    await addSeedGroups(db, {
      marker: "Стражи",
      seeded: [{ name: "Харон", about: "Перевозчик" }],
      groupsFor: () => ["Стражи"],
    });

    expect(await groupsOf(charon.id)).toEqual(["Лодочники", "Стражи"]);
  });

  it("runs once: when the marker group is there, nothing changes", async () => {
    const charon = await addContact("Харон", { about: "Перевозчик" });
    const options = {
      marker: "Стражи",
      seeded: [{ name: "Харон", about: "Перевозчик" }],
      groupsFor: () => ["Стражи", "Ад"],
    };
    await addSeedGroups(db, options);
    // The owner takes Charon out of Hell
    const [hell] = await db.select().from(groups).where(eq(groups.name, "Ад"));
    await db.delete(contactGroups).where(eq(contactGroups.groupId, hell.id));

    expect(await addSeedGroups(db, options)).toBeNull();
    expect(await groupsOf(charon.id)).toEqual(["Стражи"]);
  });
});
