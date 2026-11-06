import { describe, expect, it } from "vitest";

import { applyTestSettings, TEST_SETTINGS } from "./test-settings";

describe("test settings", () => {
  it("send mail to the stand-in even if the environment points at Resend", () => {
    const env: Record<string, string | undefined> = {
      SMTP_HOST: "smtp.resend.com",
      SMTP_PORT: "465",
      SMTP_SECURE: "true",
      SMTP_USER: "resend",
      SMTP_PASSWORD: "re_real_key",
      EMAIL_FROM: "noreply@mail.crm.crmgelos.ru",
      BETTER_AUTH_SECRET: "real-secret",
      BETTER_AUTH_URL: "https://app.crmgelos.ru",
    };

    applyTestSettings(env);

    expect(env.SMTP_HOST).toBe("127.0.0.1");
    expect(env.SMTP_PORT).toBe("1025");
    expect(env.SMTP_SECURE).toBe("false");
    expect(env.EMAIL_FROM).toBe(TEST_SETTINGS.EMAIL_FROM);
    expect(env.BETTER_AUTH_SECRET).toBe(TEST_SETTINGS.BETTER_AUTH_SECRET);
    expect(env.BETTER_AUTH_URL).toBe(TEST_SETTINGS.BETTER_AUTH_URL);
    // No login or password for the stand-in: the real key must not stay in the environment
    expect(env.SMTP_USER).toBe("");
    expect(env.SMTP_PASSWORD).toBe("");
  });

  it("are the settings the tests actually run with", () => {
    // Set by vitest.config.mts, so they win over .env and over the shell
    expect(process.env.SMTP_HOST).toBe("127.0.0.1");
    expect(process.env.SMTP_PORT).toBe("1025");
    expect(process.env.SMTP_USER).toBe("");
    expect(process.env.BETTER_AUTH_URL).toBe(TEST_SETTINGS.BETTER_AUTH_URL);
  });
});
