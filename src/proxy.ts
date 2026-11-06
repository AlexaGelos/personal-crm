import { NextResponse, type NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";

// The first line of defence, and the only place that renews the login. Runs before every page
// of the app: without a login the browser gets the login page and nothing else, not even the
// empty shell of a page (which would come with code 200).
//
// Renewing is done here because here the answer can still be changed: reading the session
// moves its term in the database, and the new cookie term goes out with this response.
// A Server Component can set no cookie, so everywhere else the session is only read
// (src/lib/session.ts). The checks in pages and actions stay: this is not the only line.
//
// Left out (see "matcher"): the files Next.js and the browser fetch before login (_next, the
// icon, the picture for link previews, the cursors), /health for the deploy check,
// /api/auth/* (the link from the email opens there; every other address of the library does
// not exist, so a request that bypasses the form gets 404 instead of a redirect) and /logout
// (it ends the session itself).

// The login page and the page of an expired link are open to those who are not in
function isLoginPage(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/");
}

// A form action posted by a page that was opened while logged in and has since expired: the
// action checks the login itself and answers with the redirect the browser can follow.
// Answered here with HTML it would break the page
function isServerAction(request: NextRequest) {
  return request.method === "POST" && request.headers.has("next-action");
}

// Next.js wants a whole address here, but for the same host it sends the browser a relative
// one, so behind nginx the app's idea of its own address does not matter
function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 307);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const { headers: sessionHeaders, response: session } = await getAuth().api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });

  let response: NextResponse;
  if (session) {
    // Logged in: the login page has nothing to offer. The page of an expired link stays: the
    // person has just opened a link that did not work and should be told so
    response = pathname === "/login" ? redirectTo(request, "/") : NextResponse.next();
  } else if (isLoginPage(pathname) || isServerAction(request)) {
    response = NextResponse.next();
  } else {
    response = redirectTo(request, "/login");
  }

  // The renewed term of the cookie, or the order to forget a cookie that is no longer good
  for (const cookie of sessionHeaders.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/|api/auth/|health$|icon\\.svg$|opengraph-image|cursors/|logout$).*)"],
};
