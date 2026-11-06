import "server-only";

import { and, count, eq, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { loginEmailSends, verifications } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { LOGIN_EMAIL_INVALID, LOGIN_TOO_OFTEN, loginEmailSchema } from "@/lib/validation";

// No more than this many login emails to one address in the window
const EMAILS_LIMIT = 3;
const WINDOW_MINUTES = 10;

export type LoginLinkResult = { email: string } | { error: string };

// All rules of "send me a link" in one place on the server: the form and any request that
// bypasses it go through here. Success carries the address as it was stored (no spaces, lower
// case), which the page shows in "Ссылка для входа отправлена на ..."
//
// 1. The address is checked and brought to one form
// 2. Under a lock on this address: the emails of the last 10 minutes are counted; at 3 the answer
//    is "too often" and nothing else happens; otherwise the email is written to the log and the
//    earlier links of the address are removed
// 3. Outside the lock: the library makes the new link and the email goes out
//
// The email goes out outside the transaction so that no database connection is held while the
// mail service answers. An email that failed to go out still counts toward the limit: counting
// only the successful ones would mean holding the lock for the whole sending
export async function requestLoginLink(
  rawEmail: string,
  headers: Headers,
): Promise<LoginLinkResult> {
  const parsed = loginEmailSchema.safeParse(rawEmail);
  if (!parsed.success) return { error: LOGIN_EMAIL_INVALID };
  const email = parsed.data;

  const allowed = await db.transaction(async (tx) => {
    // One request per address at a time: two at the same moment could both pass the count
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`login:${email}`}, 0))`);

    // Rows older than the window no longer matter; every request tidies up
    await tx
      .delete(loginEmailSends)
      .where(lt(loginEmailSends.sentAt, sql`now() - make_interval(mins => ${WINDOW_MINUTES})`));

    const [{ sent }] = await tx
      .select({ sent: count() })
      .from(loginEmailSends)
      .where(eq(loginEmailSends.email, email));
    if (sent >= EMAILS_LIMIT) return false;

    await tx.insert(loginEmailSends).values({ email });

    // A new link switches off the earlier ones. This relies on how the library keeps a link:
    // the identifier starts with "magic-link:" and the value is JSON with the address. The case
    // keeps the JSON cast away from rows of other kinds
    await tx.delete(verifications).where(
      and(
        sql`${verifications.identifier} like 'magic-link:%'`,
        sql`case when ${verifications.identifier} like 'magic-link:%'
          then ${verifications.value}::jsonb ->> 'email' end = ${email}`,
      ),
    );
    return true;
  });

  if (!allowed) return { error: LOGIN_TOO_OFTEN };

  await getAuth().api.signInMagicLink({ body: { email }, headers });
  return { email };
}
