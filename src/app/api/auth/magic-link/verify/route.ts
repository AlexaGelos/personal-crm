import { getAuth } from "@/lib/auth";

// The only address of the login library that is open to the world: the link from the email
// leads here. Everything else the library offers (asking for a link, the list of sessions,
// the profile) is called from our own server code, so a request to those addresses finds
// nothing here and gets 404.
//
// The addresses to go to afterwards are set here, not taken from the link: a damaged link with
// no parameters still ends on the page of an expired link, not on a page of the library
const AFTER_LOGIN = "/";
const AFTER_FAILURE = "/login/link-expired";

export async function GET(request: Request) {
  const url = new URL(request.url);

  // No token at all: nothing to check
  if (!url.searchParams.get("token")) {
    return new Response(null, { status: 303, headers: { location: AFTER_FAILURE } });
  }

  // The link of the email has only the token; a made-up extra address is dropped, not followed
  url.searchParams.delete("newUserCallbackURL");
  url.searchParams.set("callbackURL", AFTER_LOGIN);
  url.searchParams.set("errorCallbackURL", AFTER_FAILURE);
  return getAuth().handler(new Request(url, request));
}
