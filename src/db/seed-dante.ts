// Adds 500 test contacts themed on Dante's "Divine Comedy" next to the existing ones:
// pnpm db:seed:dante. Only adds, never changes or deletes; runs once: if Virgil is
// already in the database, no contacts are added. Then the same for the groups of these
// contacts: they are added once too, also to contacts that are already there.
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { databaseConfig, loadLocalEnv } from "./config";
import { contacts, notes } from "./schema";
import {
  ABOUT,
  CHARACTERS,
  EMAIL_DOMAINS,
  FEMALE_NAMES,
  GROUPS_MARKER,
  groupsFor,
  HOW_WE_MET,
  MALE_NAMES,
  NOTE_TEMPLATES,
  SURNAMES,
} from "./seed-dante-data";
import type { Gender } from "./seed-data";
import { addSeedGroups, chunk, createRandom } from "./seed-tools";

const CONTACT_COUNT = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

const random = createRandom(13001321);
const chance = (probability: number) => random() < probability;
const randomInt = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];

// Italian mobile numbers: the Florentines are reachable from home
function makePhone(usedPhones: Set<string>) {
  let phone: string;
  do {
    phone = `+39 3${randomInt(20, 99)} ${randomInt(100, 999)} ${String(randomInt(0, 9999)).padStart(4, "0")}`;
  } while (usedPhones.has(phone));
  usedPhones.add(phone);
  return phone;
}

function makeEmail(first: string, last: string, usedEmails: Set<string>) {
  const local = pick([
    `${first}.${last}`,
    `${first[0]}.${last}`,
    `${last}.${first}`,
    `${first}${last}`,
    `${first}_${last}`,
    `${last}${randomInt(1265, 1321)}`,
  ]);
  const domain = pick(EMAIL_DOMAINS);

  let email = `${local}@${domain}`;
  for (let n = 2; usedEmails.has(email); n++) email = `${local}${n}@${domain}`;
  usedEmails.add(email);
  return email;
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
  const usedEmails = new Set<string>();
  const usedPhones = new Set<string>();
  const createdAt = () => new Date(now - randomInt(1, 3 * 365) * DAY_MS - randomInt(0, DAY_MS));

  // First the souls from the poem, then Florentines of the time with made-up names
  const result: SeedContact[] = CHARACTERS.map((character) => {
    if (character.email) usedEmails.add(character.email);
    return {
      name: character.name,
      about: character.about,
      howWeMet: character.howWeMet,
      phone: character.phone === false ? null : chance(0.7) ? makePhone(usedPhones) : null,
      email: character.email ?? null,
      createdAt: createdAt(),
      noteBodies: character.notes,
    };
  });

  const usedNames = new Set(result.map((contact) => contact.name));
  while (result.length < CONTACT_COUNT) {
    const gender: Gender = chance(0.55) ? "male" : "female";
    const [firstName, firstLatin] = pick(gender === "male" ? MALE_NAMES : FEMALE_NAMES);
    const [surname, surnameLatin] = pick(SURNAMES);
    const name = `${firstName} ${surname}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);

    const g = (male: string, female: string) => (gender === "male" ? male : female);
    const about = chance(0.9) ? pick(ABOUT) : null;

    result.push({
      name,
      about: about === null ? null : typeof about === "string" ? about : g(...about),
      howWeMet: chance(0.85) ? pick(HOW_WE_MET) : null,
      phone: chance(0.85) ? makePhone(usedPhones) : null,
      email: chance(0.75) ? makeEmail(firstLatin, surnameLatin, usedEmails) : null,
      createdAt: createdAt(),
      noteBodies: Array.from({ length: noteCount() }, () => pick(NOTE_TEMPLATES)(pick, g)),
    });
  }

  return result;
}

type Database = ReturnType<typeof drizzle>;

async function addContacts(db: Database, generated: SeedContact[], now: number) {
  const added = await db.$count(contacts, eq(contacts.name, CHARACTERS[0].name));
  if (added > 0) {
    console.log("The Divine Comedy contacts are already in the database: no contacts were added.");
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

  console.log(`Added ${generated.length} Divine Comedy contacts and ${noteTotal} notes.`);
}

// Groups go to the Divine Comedy contacts that are in the database, whether this run added them
// or an earlier one did. The generator is seeded, so "generated" holds the same names and "Кто это"
// as when the contacts were added. Groups from an earlier run stay and get the new members too
async function addGroups(db: Database, generated: SeedContact[]) {
  const result = await addSeedGroups(db, {
    marker: GROUPS_MARKER,
    seeded: generated.map((contact) => ({ name: contact.name, about: contact.about ?? null })),
    groupsFor,
  });

  console.log(
    result === null
      ? "The Divine Comedy groups are already in the database: no groups were added."
      : `Added ${result.groupCount} Divine Comedy groups and put contacts into groups ${result.linkCount} times.`,
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
