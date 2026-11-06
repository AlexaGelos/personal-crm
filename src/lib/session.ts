import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/auth";

// Who is looking at the page: the user of the session in the request cookie, or null.
// "cache" keeps one answer per render, so the header, the page and its parts ask the database once.
//
// The session is only read here, never renewed (disableRefresh): a Server Component cannot
// set a cookie, so a renewal would move the term in the database but not in the browser.
// The one place that renews is src/proxy.ts, where the answer can still carry the cookie
export const getCurrentUser = cache(async () => {
  // First of all: while the page is built, this is where the render stops and waits for a real
  // request. Settings are checked only after it (getAuth), because the build has none
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({
    headers: requestHeaders,
    query: { disableRefresh: true },
  });
  return session?.user ?? null;
});

// For every page part and every server action that touches data: the id of the user, or
// the login page. Second line of defence: src/proxy.ts is the first, but it is not the only one
export async function requireUserId() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user.id;
}
