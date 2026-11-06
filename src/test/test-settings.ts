// Settings the automated tests always run with, whatever .env or the shell say:
// mail goes to the Mailpit stand-in, never to a real mail service.
// Used by vitest.config.mts and playwright.config.ts

// Playwright starts the app on this port (see playwright.config.ts); links in the emails lead there
export const E2E_PORT = 3100;

export const TEST_SETTINGS = {
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "1025",
  SMTP_SECURE: "false",
  // Empty, not removed: a name that is not set would be filled in from .env, an empty one stays.
  // The stand-in takes no login, so a real key from .env must not be passed along
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  EMAIL_FROM: "noreply@crm.test",
  // Not a real secret: only the test database and the stand-in mail service see it
  BETTER_AUTH_SECRET: "test-only-secret-0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: `http://127.0.0.1:${E2E_PORT}`,
} as const;

export function applyTestSettings(env: Record<string, string | undefined> = process.env) {
  Object.assign(env, TEST_SETTINGS);
}
