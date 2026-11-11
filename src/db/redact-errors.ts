import { DrizzleQueryError } from "drizzle-orm/errors";
import { PgPreparedQuery } from "drizzle-orm/pg-core";

// Drizzle's error for a failed query carries all the values of the query, in its message and
// in the stack: names, phones, emails and notes of the friends, or the key of a login link.
// Next.js and the login library write such errors to the server log as they are, and that log
// is kept and read by more people than the data itself. So the error is replaced by one that
// says what failed - the query text with $1, $2 in place of the values, and the error code -
// and nothing else

export class DatabaseQueryError extends Error {
  readonly query: string;
  // Postgres error code ("23505") or network error code ("ECONNREFUSED"), if the cause has one
  readonly code: string | undefined;

  constructor(query: string, code: string | undefined, frames: string) {
    super(`Database query failed${code ? ` (code ${code})` : ""}: ${query}`);
    this.name = "DatabaseQueryError";
    this.query = query;
    this.code = code;
    // The place in our code where the query was made, without the line with the values
    if (frames) this.stack = `${this.name}: ${this.message}${frames}`;
  }
}

// The code only, never the message or the details of the cause: the message of Postgres
// can hold a value ('invalid input syntax for type integer: "Иван"'). Connection errors may be
// an AggregateError with the codes inside
function codeOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;

  if ("code" in error && typeof error.code === "string") return error.code;
  if ("errors" in error && Array.isArray(error.errors)) {
    for (const inner of error.errors) {
      const code = codeOf(inner);
      if (code) return code;
    }
  }
  return undefined;
}

// The stack of the original error is the line "Error: <message>" and then the frames. The
// message holds the values and may have many lines, so the frames are cut off by the known
// length of that first part, not found by looking for "at"
function framesOf(error: DrizzleQueryError) {
  const header = `${error.name}: ${error.message}`;
  return error.stack?.startsWith(header) ? error.stack.slice(header.length) : "";
}

export function redactQueryError(error: unknown): unknown {
  if (!(error instanceof DrizzleQueryError)) return error;
  return new DatabaseQueryError(error.query, codeOf(error.cause), framesOf(error));
}

const PATCHED = Symbol.for("personal-crm.hide-query-values");

type QueryRunner = (this: unknown, ...args: unknown[]) => Promise<unknown>;

// Every query - in a transaction or not, a select, an insert, a call of the login library -
// is run by queryWithCache of PgPreparedQuery, and that is where Drizzle makes its error. A
// patch of "then" of the query builders is not enough: some of them hold a copy of it. Safe
// to call many times (hot reload in development)
export function hideQueryValues() {
  const prototype = PgPreparedQuery.prototype as unknown as Record<PropertyKey, unknown>;
  if (prototype[PATCHED]) return;

  const original = prototype.queryWithCache;
  // queryWithCache is internal to Drizzle: after an update it may be gone. Fail at once, not
  // by quietly putting the values back into the log
  if (typeof original !== "function") {
    throw new Error(
      "Drizzle no longer has PgPreparedQuery.queryWithCache: update redact-errors.ts",
    );
  }

  prototype.queryWithCache = async function (this: unknown, ...args: unknown[]) {
    try {
      return await (original as QueryRunner).apply(this, args);
    } catch (error) {
      throw redactQueryError(error);
    }
  };
  prototype[PATCHED] = true;
}
