// Fills an empty database with realistic test contacts and puts them into groups: pnpm db:seed.
// The groups are added once, also to test contacts that are already in the database
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { databaseConfig, loadLocalEnv } from "./config";
import { contacts, notes } from "./schema";
import {
  ABOUT,
  EMAIL_DOMAINS,
  FEMALE_NAMES,
  GROUPS_MARKER,
  groupsFor,
  HOW_WE_MET,
  MALE_NAMES,
  NOTE_TEMPLATES,
  SURNAMES,
  type Gender,
} from "./seed-data";
import { addSeedGroups, chunk, createRandom } from "./seed-tools";

const CONTACT_COUNT = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const random = createRandom(20261008);
const chance = (probability: number) => random() < probability;
const randomInt = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];

function femaleSurname(surname: string) {
  if (/(ский|цкий)$/.test(surname)) return surname.replace(/ий$/, "ая");
  if (/(ов|ев|ёв|ин|ын)$/.test(surname)) return `${surname}а`;
  return surname; // Черных, Ким, Шевчук, Бондаренко...
}

const TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function translit(text: string) {
  return [...text.toLowerCase()].map((char) => TRANSLIT[char] ?? char).join("");
}

function makeEmail(firstName: string, surname: string, usedEmails: Set<string>) {
  const first = translit(firstName);
  const last = translit(surname);
  const local = pick([
    `${first}.${last}`,
    `${first[0]}.${last}`,
    `${last}.${first}`,
    `${first}${last}`,
    `${first}_${last}`,
    `${last}${randomInt(70, 99)}`,
  ]);
  const domain = pick(EMAIL_DOMAINS);

  let email = `${local}@${domain}`;
  for (let n = 2; usedEmails.has(email); n++) email = `${local}${n}@${domain}`;
  usedEmails.add(email);
  return email;
}

function makePhone(usedPhones: Set<string>) {
  let phone: string;
  do {
    const digits = String(randomInt(0, 9_999_999)).padStart(7, "0");
    phone = `+7 9${randomInt(0, 99).toString().padStart(2, "0")} ${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  } while (usedPhones.has(phone));
  usedPhones.add(phone);
  return phone;
}

// 0 notes for a quarter of contacts, up to 6 for the most talkative ones
function noteCount() {
  const roll = random();
  if (roll < 0.25) return 0;
  if (roll < 0.5) return 1;
  if (roll < 0.7) return 2;
  if (roll < 0.85) return 3;
  return randomInt(4, 6);
}

type SeedContact = typeof contacts.$inferInsert & {
  name: string;
  createdAt: Date;
  noteBodies: string[];
};

function generateContacts(now: number): SeedContact[] {
  const usedNames = new Set<string>();
  const usedEmails = new Set<string>();
  const usedPhones = new Set<string>();
  const result: SeedContact[] = [];

  while (result.length < CONTACT_COUNT) {
    const gender: Gender = chance(0.5) ? "male" : "female";
    const firstName = pick(gender === "male" ? MALE_NAMES : FEMALE_NAMES);
    const baseSurname = pick(SURNAMES);
    const surname = gender === "male" ? baseSurname : femaleSurname(baseSurname);
    const name = `${firstName} ${surname}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);

    const g = (male: string, female: string) => (gender === "male" ? male : female);
    const about = chance(0.9) ? pick(ABOUT) : null;

    result.push({
      name,
      about: about === null ? null : typeof about === "string" ? about : g(...about),
      howWeMet: chance(0.85) ? pick(HOW_WE_MET) : null,
      phone: chance(0.88) ? makePhone(usedPhones) : null,
      email: chance(0.75) ? makeEmail(firstName, surname, usedEmails) : null,
      createdAt: new Date(now - randomInt(1, 3 * 365) * DAY_MS - randomInt(0, DAY_MS)),
      noteBodies: Array.from({ length: noteCount() }, () => pick(NOTE_TEMPLATES)(pick, g)),
    });
  }

  return result;
}

type Database = ReturnType<typeof drizzle>;

// Contacts go only into an empty database
async function addContacts(db: Database, generated: SeedContact[], now: number) {
  const existing = await db.$count(contacts);
  if (existing > 0) {
    console.log(`The database already has ${existing} contacts: no contacts were added.`);
    return;
  }

  const noteTotal = await db.transaction(async (tx) => {
    const idByName = new Map<string, number>();
    for (const part of chunk(generated, 250)) {
      const rows = await tx
        .insert(contacts)
        .values(
          part.map(({ name, about, howWeMet, phone, email, createdAt }) => ({
            name,
            about,
            howWeMet,
            phone,
            email,
            createdAt,
          })),
        )
        .returning({ id: contacts.id, name: contacts.name });
      for (const row of rows) idByName.set(row.name, row.id);
    }

    // Notes are spread between the contact's creation date and today, oldest first
    const noteRows = generated.flatMap((contact) => {
      const start = contact.createdAt.getTime();
      const dates = contact.noteBodies
        .map(() => new Date(start + random() * (now - start)))
        .sort((a, b) => a.getTime() - b.getTime());
      return contact.noteBodies.map((body, i) => ({
        contactId: idByName.get(contact.name)!,
        body,
        createdAt: dates[i],
      }));
    });

    for (const part of chunk(noteRows, 500)) {
      await tx.insert(notes).values(part);
    }
    return noteRows.length;
  });

  console.log(`Seeded ${generated.length} contacts and ${noteTotal} notes.`);
}

// Groups go to the test contacts that are in the database, whether this run added them or an
// earlier one did. The generator is seeded, so "generated" holds the same names and "Кто это"
// as when the contacts were added
async function addGroups(db: Database, generated: SeedContact[]) {
  const result = await addSeedGroups(db, {
    marker: GROUPS_MARKER,
    seeded: generated.map((contact) => ({ name: contact.name, about: contact.about ?? null })),
    groupsFor,
  });

  console.log(
    result === null
      ? "The test contact groups are already in the database: no groups were added."
      : `Added ${result.groupCount} groups and put contacts into groups ${result.linkCount} times.`,
  );
}

async function main() {
  loadLocalEnv();
  const sql = postgres({ ...databaseConfig(), max: 1, onnotice: () => {} });
  const db = drizzle(sql);

  try {
    // Generated first and only once: the random numbers must come in the same order as always
    const now = Date.now();
    const generated = generateContacts(now);

    await addContacts(db, generated, now);
    await addGroups(db, generated);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
