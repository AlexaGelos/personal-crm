import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { LOGIN_LINK_MINUTES, sendLoginEmail } from "@/lib/email";

// Login lives for 30 days from the last visit. The session is renewed when it is read, but
// written to the database at most once an hour (updateAge): the expiry is exact to the hour
const SESSION_DAYS = 30;
const SESSION_RENEW_SECONDS = 60 * 60;

// The library refuses to work with a short secret
const MIN_SECRET_LENGTH = 32;

function createAuth() {
  const { BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: baseURL } = process.env;

  const missing = [
    ["BETTER_AUTH_SECRET", secret],
    ["BETTER_AUTH_URL", baseURL],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Login settings are missing: set ${missing.join(", ")}`);
  }
  if (secret!.length < MIN_SECRET_LENGTH) {
    throw new Error(`BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters long`);
  }

  return betterAuth({
    secret,
    // The address the app is opened on: the links in the emails lead there, and the cookie
    // is Secure when it starts with https
    baseURL,
    // Tables are plural (users, sessions...) like the rest of the schema
    database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
    session: {
      expiresIn: SESSION_DAYS * 24 * 60 * 60,
      updateAge: SESSION_RENEW_SECONDS,
      // No copy of the session in a cookie: logging out and the end of the term must work at once
    },
    // The built-in limit counts requests from one address, not emails to one address, and would
    // answer the fast logins of the e2e tests with 429. Outside the library there is only the
    // address of the link check (src/app/api/auth/magic-link/verify), which takes a token of
    // 32 random characters. The limit on emails per address is in src/lib/login.ts
    rateLimit: { enabled: false },
    plugins: [
      magicLink({
        expiresIn: LOGIN_LINK_MINUTES * 60,
        // Only a hash of the token is stored: the link cannot be rebuilt from a copy of the database
        storeToken: "hashed",
        sendMagicLink: ({ email, url }) => sendLoginEmail({ to: email, url }),
      }),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;

let auth: Auth | undefined;

// Created on the first call, not on import: "next build" loads this module without the
// settings (the Docker image is built without .env), and the library fails to start without
// a secret
export function getAuth(): Auth {
  auth ??= createAuth();
  return auth;
}
