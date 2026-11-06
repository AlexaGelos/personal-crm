// The action of the login form on the test database and the Mailpit stand-in. Only "headers()",
// which needs a real request, is stubbed
import { afterEach, describe, expect, it, vi } from "vitest";

import { sendLoginLink } from "@/app/login/actions";
import { db } from "@/db";
import { loginEmailSends, verifications } from "@/db/schema";
import { deleteMessagesTo, messagesTo, uniqueAddress, waitForMessages } from "@/test/mailpit";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

function form(email: string) {
  const formData = new FormData();
  formData.set("email", email);
  return formData;
}

const used: string[] = [];
function address() {
  const email = uniqueAddress();
  used.push(email);
  return email;
}

afterEach(async () => {
  await Promise.all(used.splice(0).map(deleteMessagesTo));
});

describe("sendLoginLink", () => {
  it("says to whom the link was sent, with the address as it was stored", async () => {
    const email = address();

    const state = await sendLoginLink({}, form(`  ${email.toUpperCase()} `));

    expect(state).toEqual({ sentTo: email });
    expect(await waitForMessages(email)).toHaveLength(1);
  });

  it("answers an address that is not one with the error and keeps what was typed", async () => {
    const state = await sendLoginLink({}, form("anna@"));

    expect(state).toEqual({ email: "anna@", error: "Проверь адрес почты" });
  });

  it("sends no email and makes no link for an address sent around the form", async () => {
    const email = address();

    // No field at all, an empty one, and an address with a typo
    await sendLoginLink({}, new FormData());
    await sendLoginLink({}, form(""));
    await sendLoginLink({}, form(email.replace("@", "@@")));

    expect(await messagesTo(email)).toEqual([]);
    expect(await db.select().from(verifications)).toEqual([]);
    expect(await db.select().from(loginEmailSends)).toEqual([]);
  });

  it("says «too often» for the fourth email in 10 minutes", async () => {
    const email = address();
    for (let i = 0; i < 3; i++) await sendLoginLink({}, form(email));

    const state = await sendLoginLink({}, form(email));

    expect(state).toEqual({
      email,
      error: "Слишком часто, попробуй через несколько минут",
    });
    expect(await messagesTo(email)).toHaveLength(3);
  });

  it("fails, instead of saying the link was sent, when the mail service does not answer", async () => {
    const before = process.env.SMTP_PORT;
    process.env.SMTP_PORT = "1";

    try {
      // The error is not caught: the page shows the general error screen (src/app/error.tsx)
      await expect(sendLoginLink({}, form(address()))).rejects.toThrow();
    } finally {
      process.env.SMTP_PORT = before;
    }
  });
});
