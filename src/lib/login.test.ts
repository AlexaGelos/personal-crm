import { and, eq, like, sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { loginEmailSends, verifications } from "@/db/schema";
import { requestLoginLink } from "@/lib/login";
import { deleteMessagesTo, messagesTo, uniqueAddress, waitForMessages } from "@/test/mailpit";

const sentTo = (email: string) => ({ email });
const TOO_OFTEN = { error: "Слишком часто, попробуй через несколько минут" };
const INVALID = { error: "Проверь адрес почты" };
const MINUTE_MS = 60 * 1000;

const used: string[] = [];
function address(prefix = "anna") {
  const email = uniqueAddress(prefix);
  used.push(email);
  return email;
}

afterEach(async () => {
  await Promise.all(used.splice(0).map(deleteMessagesTo));
});

function request(rawEmail: string) {
  return requestLoginLink(rawEmail, new Headers());
}

// The links of an address that are still alive: the library keeps one row of verifications each
async function liveLinks(email: string) {
  return db
    .select()
    .from(verifications)
    .where(
      and(
        like(verifications.identifier, "magic-link:%"),
        sql`${verifications.value}::jsonb ->> 'email' = ${email}`,
      ),
    );
}

function tokenOf(text: string) {
  const token = new URL(text.match(/https?:\/\/\S+/)![0]).searchParams.get("token");
  if (!token) throw new Error(`No token in:\n${text}`);
  return token;
}

describe("requestLoginLink: the address", () => {
  it("sends the link to the address brought to one form", async () => {
    const email = address();

    const result = await request(`  ${email.toUpperCase()}  `);

    expect(result).toEqual(sentTo(email));
    const [message] = await waitForMessages(email);
    expect(message.to).toEqual([email]);
  });

  it("refuses an address that is not one and sends and stores nothing", async () => {
    for (const email of ["anna@", "", "   ", "anna", "anna@@example.com"]) {
      expect(await request(email), email).toEqual(INVALID);
    }

    expect(await db.select().from(verifications)).toEqual([]);
    expect(await db.select().from(loginEmailSends)).toEqual([]);
  });
});

describe("requestLoginLink: the link", () => {
  it("lives for 15 minutes", async () => {
    const email = address();

    await request(email);

    const [link] = await liveLinks(email);
    const lifetime = link.expiresAt.getTime() - Date.now();
    expect(lifetime).toBeGreaterThan(14 * MINUTE_MS);
    expect(lifetime).toBeLessThanOrEqual(15 * MINUTE_MS);
  });

  it("is stored as a hash: the token from the email is not in the database", async () => {
    const email = address();

    await request(email);

    const [{ text }] = await waitForMessages(email);
    const token = tokenOf(text);
    const rows = await db.select().from(verifications);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("is replaced by a new one: the earlier links of the address are gone", async () => {
    const email = address();

    await request(email);
    const [first] = await liveLinks(email);
    await request(email);

    const links = await liveLinks(email);
    expect(links).toHaveLength(1);
    expect(links[0].identifier).not.toBe(first.identifier);
  });

  it("is not disabled by a link requested for another address", async () => {
    const anna = address("anna");
    const boris = address("boris");

    await request(anna);
    await request(boris);

    expect(await liveLinks(anna)).toHaveLength(1);
    expect(await liveLinks(boris)).toHaveLength(1);
  });
});

describe("requestLoginLink: the limit of 3 emails in 10 minutes", () => {
  it("sends 3 emails and refuses the fourth", async () => {
    const email = address();

    for (let i = 0; i < 3; i++) expect(await request(email)).toEqual(sentTo(email));
    expect(await request(email)).toEqual(TOO_OFTEN);

    expect(await messagesTo(email)).toHaveLength(3);
  });

  it("makes no new link when the limit is hit: the last link sent stays alive", async () => {
    const email = address();
    for (let i = 0; i < 3; i++) await request(email);
    const [last] = await liveLinks(email);

    await request(email);

    const links = await liveLinks(email);
    expect(links).toHaveLength(1);
    expect(links[0].identifier).toBe(last.identifier);
  });

  it("lets a new email go when the first of the three is older than 10 minutes", async () => {
    const email = address();
    for (let i = 0; i < 3; i++) await request(email);
    await db
      .update(loginEmailSends)
      .set({ sentAt: sql`now() - interval '11 minutes'` })
      .where(
        eq(loginEmailSends.id, sql`(select min(id) from login_email_sends where email = ${email})`),
      );

    expect(await request(email)).toEqual(sentTo(email));

    expect(await messagesTo(email)).toHaveLength(4);
  });

  it("counts every address on its own", async () => {
    const anna = address("anna");
    const boris = address("boris");
    for (let i = 0; i < 3; i++) await request(anna);

    expect(await request(boris)).toEqual(sentTo(boris));
  });

  it("counts the same address written in other letters as one", async () => {
    const email = address();
    for (let i = 0; i < 3; i++) await request(email);

    expect(await request(` ${email.toUpperCase()} `)).toEqual(TOO_OFTEN);
  });

  it("lets no more than 3 emails out of five requests at the same moment", async () => {
    const email = address();

    const results = await Promise.all(Array.from({ length: 5 }, () => request(email)));

    expect(results.filter((result) => "email" in result)).toHaveLength(3);
    expect(results.filter((result) => "error" in result)).toHaveLength(2);
    expect(await waitForMessages(email, 3)).toHaveLength(3);
    expect(await messagesTo(email)).toHaveLength(3);
  });
});
