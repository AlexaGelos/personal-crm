import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { sessions } from "@/db/schema";
import { signInAs } from "@/test/login";
import { uniqueAddress } from "@/test/mailpit";

// The request the page is rendered for: its headers are what "headers()" gives
let requestHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));

// A real "redirect" throws to stop the page; the test sees where it went
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
}));

const { getCurrentUser, requireUserId } = await import("@/lib/session");

beforeEach(() => {
  requestHeaders = new Headers();
});

describe("getCurrentUser", () => {
  it("gives the user of a valid session", async () => {
    const email = uniqueAddress();
    const { cookie, user } = await signInAs(email);
    requestHeaders = new Headers({ cookie });

    expect(await getCurrentUser()).toMatchObject({ id: user.id, email });
  });

  it("gives nothing without a cookie", async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it("gives nothing for a cookie nobody issued", async () => {
    requestHeaders = new Headers({ cookie: "better-auth.session_token=forged.signature" });

    expect(await getCurrentUser()).toBeNull();
  });

  it("gives nothing after the term of the session", async () => {
    const { cookie } = await signInAs(uniqueAddress());
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 60 * 1000) });
    requestHeaders = new Headers({ cookie });

    expect(await getCurrentUser()).toBeNull();
  });

  it("gives nothing after the session was ended", async () => {
    const { cookie } = await signInAs(uniqueAddress());
    await db.delete(sessions);
    requestHeaders = new Headers({ cookie });

    expect(await getCurrentUser()).toBeNull();
  });

  it("does not renew the session: only src/proxy.ts does, where the cookie can be set", async () => {
    const { cookie } = await signInAs(uniqueAddress());
    // 29 days since the last visit: a reading that renewed it would move the term to 30 days
    const oneDayLeft = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.update(sessions).set({ expiresAt: oneDayLeft });
    requestHeaders = new Headers({ cookie });

    await getCurrentUser();

    const [session] = await db.select().from(sessions).where(eq(sessions.expiresAt, oneDayLeft));
    expect(session).toBeDefined();
  });
});

describe("requireUserId", () => {
  it("gives the id of the user who is in", async () => {
    const { cookie, user } = await signInAs(uniqueAddress());
    requestHeaders = new Headers({ cookie });

    expect(await requireUserId()).toBe(user.id);
  });

  it("sends to the login page when nobody is in", async () => {
    await expect(requireUserId()).rejects.toThrow("REDIRECT /login");
  });
});
