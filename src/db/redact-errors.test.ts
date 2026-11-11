import { inspect } from "node:util";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import { DatabaseQueryError, redactQueryError } from "@/db/redact-errors";
import { addContact, TEST_USER_ID } from "@/test/helpers";

// A value that must never reach the logs
const SECRET = "SECRET-friend-phone-+79990001122";

// Everything a logger can print from an error: the message, the stack, and the whole object
function everythingPrinted(error: unknown) {
  const text = [inspect(error, { depth: 10, showHidden: true })];
  if (error instanceof Error) text.push(error.message, error.stack ?? "");
  try {
    text.push(JSON.stringify(error));
  } catch {
    // Not serializable: nothing more to print
  }
  return text.join("\n");
}

async function failureOf(run: () => PromiseLike<unknown>) {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("The query was expected to fail");
}

describe("errors of failed queries", () => {
  it("do not carry the values of the query", async () => {
    // A note for a contact that does not exist breaks the foreign key
    const error = await failureOf(() =>
      db.insert(notes).values({ contactId: 999_999, body: SECRET }),
    );

    expect(error).toBeInstanceOf(DatabaseQueryError);
    expect(everythingPrinted(error)).not.toContain(SECRET);
  });

  it("keep what is needed to find the cause: the query text and the code", async () => {
    const error = (await failureOf(() =>
      db.insert(notes).values({ contactId: 999_999, body: SECRET }),
    )) as DatabaseQueryError;

    expect(error.code).toBe("23503");
    expect(error.query).toContain('insert into "notes"');
    expect(error.message).toContain("23503");
    expect(error.message).not.toContain("params");
  });

  it("do not carry the values when the query fails inside a transaction", async () => {
    const contact = await addContact(TEST_USER_ID, "Иван");

    const error = await failureOf(() =>
      db.transaction(async (tx) => {
        await tx.update(contacts).set({ about: SECRET }).where(eq(contacts.id, contact.id));
        await tx.insert(notes).values({ contactId: 999_999, body: SECRET });
      }),
    );

    expect(error).toBeInstanceOf(DatabaseQueryError);
    expect(everythingPrinted(error)).not.toContain(SECRET);
  });

  it("do not carry the values when the database is not reachable", async () => {
    // Nothing listens on port 1: the connection is refused
    const unreachable = drizzle(
      postgres({ host: "127.0.0.1", port: 1, user: "nobody", password: "none", database: "none" }),
    );

    const error = await failureOf(() =>
      unreachable.select().from(contacts).where(eq(contacts.phone, SECRET)),
    );

    expect(error).toBeInstanceOf(DatabaseQueryError);
    expect((error as DatabaseQueryError).code).toBeTruthy();
    expect(everythingPrinted(error)).not.toContain(SECRET);
  });

  it("do not carry the values when the query is handled with catch", async () => {
    let caught: unknown;
    await db
      .insert(notes)
      .values({ contactId: 999_999, body: SECRET })
      .catch((error) => {
        caught = error;
      });

    expect(caught).toBeInstanceOf(DatabaseQueryError);
    expect(everythingPrinted(caught)).not.toContain(SECRET);
  });
});

describe("redactQueryError", () => {
  it("leaves other errors as they are", () => {
    const error = new Error("Something else");

    expect(redactQueryError(error)).toBe(error);
    expect(redactQueryError("text")).toBe("text");
  });
});
