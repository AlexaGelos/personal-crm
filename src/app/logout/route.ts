import { getAuth } from "@/lib/auth";

// «Выйти»: an ordinary HTML form posts here, so the browser loads a whole new page. That
// matters: pages the browser keeps for quick return (hidden, but alive) would otherwise still
// hold the data of the user who has just left. Only this device is logged out
export async function POST(request: Request) {
  // A form on another site must not be able to log a person out
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return new Response(null, { status: 403 });
  }

  const headers = new Headers({ location: "/login" });
  try {
    const { headers: signOutHeaders } = await getAuth().api.signOut({
      headers: request.headers,
      returnHeaders: true,
    });
    for (const cookie of signOutHeaders.getSetCookie()) headers.append("set-cookie", cookie);
  } catch {
    // Not logged in anyway (no cookie, or the session was already gone): the login page is the
    // right place all the same
  }

  // 303: the browser follows a POST with a plain GET
  return new Response(null, { status: 303, headers });
}
