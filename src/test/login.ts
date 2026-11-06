// Logs a user in the way the app does: asks for a link, reads it from the Mailpit stand-in and
// opens it. Gives the cookie the browser would hold, for tests that read the session
import { getAuth } from "@/lib/auth";
import { requestLoginLink } from "@/lib/login";
import { deleteMessagesTo, latestLoginLink } from "@/test/mailpit";

export async function signInAs(email: string) {
  const result = await requestLoginLink(email, new Headers());
  if ("error" in result) throw new Error(`Could not ask for a link: ${result.error}`);

  const token = new URL(await latestLoginLink(result.email)).searchParams.get("token");
  await deleteMessagesTo(result.email);
  if (!token) throw new Error("No token in the login link");

  // Without a callback address the library answers with JSON and sets the cookie
  const response = await getAuth().api.magicLinkVerify({
    query: { token },
    headers: new Headers(),
    asResponse: true,
  });
  const cookie = response.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error(`Login gave no cookie (status ${response.status})`);

  const { user } = (await response.json()) as { user: { id: string; email: string } };
  return { cookie, user };
}
