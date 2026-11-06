import { createServer, type Server } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { sendLoginEmail, transportOptions } from "@/lib/email";
import { deleteMessagesTo, uniqueAddress, waitForMessages } from "@/test/mailpit";
import { TEST_SETTINGS } from "@/test/test-settings";

const LINK = "http://127.0.0.1:3100/api/auth/magic-link/verify?token=abc123&callbackURL=%2F";

const sent: string[] = [];
function address() {
  const to = uniqueAddress("anna");
  sent.push(to);
  return to;
}

afterEach(async () => {
  await Promise.all(sent.splice(0).map(deleteMessagesTo));
});

// Settings are read when an email is sent: a test changes them for its own duration only
function withSettings(settings: Record<string, string | undefined>, run: () => Promise<void>) {
  const before = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
  Object.assign(process.env, settings);
  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) delete process.env[key];
  }
  return run().finally(() => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

describe("the login email", () => {
  it("comes from «Личная CRM» with the address from the settings and the right subject", async () => {
    const to = address();

    await sendLoginEmail({ to, url: LINK });

    const [message] = await waitForMessages(to);
    expect(message.from).toEqual({ name: "Личная CRM", address: TEST_SETTINGS.EMAIL_FROM });
    expect(message.subject).toBe("Вход в Личную CRM");
  });

  it("has the «Войти» button with the link, 15 minutes and the ignore line", async () => {
    const to = address();

    await sendLoginEmail({ to, url: LINK });

    const [{ html }] = await waitForMessages(to);
    const button = html.match(/<a\b[^>]*href="([^"]*)"[^>]*>\s*Войти\s*<\/a>/);
    expect(button, "the «Войти» button").not.toBeNull();
    // In HTML an & in an address is written as &amp;
    expect(button![1].replaceAll("&amp;", "&")).toBe(LINK);
    expect(html).toContain("15 минут");
    expect(html).toContain("Если вы не запрашивали вход - просто проигнорируйте письмо");
  });

  it("has a plain text version with the same link and words", async () => {
    const to = address();

    await sendLoginEmail({ to, url: LINK });

    const [{ text }] = await waitForMessages(to);
    expect(text).toContain(LINK);
    expect(text).toContain("15 минут");
    expect(text).toContain("Если вы не запрашивали вход - просто проигнорируйте письмо");
  });
});

describe("transportOptions: where the emails go", () => {
  const resend = {
    SMTP_HOST: "smtp.resend.com",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "resend",
    SMTP_PASSWORD: "re_key",
    EMAIL_FROM: "noreply@mail.crm.crmgelos.ru",
  };

  it("points at Resend over TLS with the login and the key", () => {
    expect(transportOptions(resend)).toMatchObject({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: { user: "resend", pass: "re_key" },
    });
  });

  it("points at the stand-in without TLS and without a login", () => {
    const options = transportOptions({
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "1025",
      SMTP_SECURE: "false",
      SMTP_USER: "",
      SMTP_PASSWORD: "",
      EMAIL_FROM: "noreply@crm.test",
    });

    expect(options).toMatchObject({ host: "127.0.0.1", port: 1025, secure: false });
    expect(options.auth).toBeUndefined();
  });

  it("has short timeouts, so a form never hangs for minutes", () => {
    const options = transportOptions(resend);

    for (const timeout of [options.connectionTimeout, options.greetingTimeout]) {
      expect(timeout).toBeGreaterThan(0);
      expect(timeout).toBeLessThanOrEqual(10_000);
    }
    expect(options.socketTimeout).toBeLessThanOrEqual(20_000);
  });

  it("says which settings are missing", () => {
    expect(() => transportOptions({ SMTP_HOST: "127.0.0.1" })).toThrow(
      /SMTP_PORT.*EMAIL_FROM|EMAIL_FROM.*SMTP_PORT/,
    );
  });

  it("refuses a login without a key and the other way round", () => {
    expect(() => transportOptions({ ...resend, SMTP_PASSWORD: "" })).toThrow(/SMTP_PASSWORD/);
    expect(() => transportOptions({ ...resend, SMTP_USER: "" })).toThrow(/SMTP_USER/);
  });

  it("refuses a port that is not a number", () => {
    expect(() => transportOptions({ ...resend, SMTP_PORT: "abc" })).toThrow(/SMTP_PORT/);
  });
});

describe("sendLoginEmail reads the settings when it is called", () => {
  it("follows a change of the settings without a restart", async () => {
    const to = address();

    // Nothing listens on this port: if the settings were read once on load, the email would
    // still go to the stand-in and this would not fail
    await withSettings({ SMTP_PORT: "1" }, async () => {
      await expect(sendLoginEmail({ to, url: LINK })).rejects.toThrow();
    });

    await sendLoginEmail({ to, url: LINK });
    expect(await waitForMessages(to)).toHaveLength(1);
  });

  it("fails with a clear message when the settings are missing", async () => {
    await withSettings({ SMTP_HOST: undefined }, async () => {
      await expect(sendLoginEmail({ to: address(), url: LINK })).rejects.toThrow(/SMTP_HOST/);
    });
  });
});

describe("the mail service is unavailable", () => {
  let silent: Server | undefined;

  afterEach(() => {
    silent?.close();
    silent = undefined;
  });

  it("fails at once when nothing listens", async () => {
    const started = Date.now();

    await withSettings({ SMTP_PORT: "1" }, async () => {
      await expect(sendLoginEmail({ to: address(), url: LINK })).rejects.toThrow();
    });

    expect(Date.now() - started).toBeLessThan(3_000);
  });

  it("gives up in seconds when the service accepts the connection and says nothing", async () => {
    // Takes the connection and never greets: without a timeout the email would wait for minutes
    silent = createServer(() => {});
    await new Promise<void>((resolve) => silent!.listen(0, "127.0.0.1", resolve));
    const { port } = silent.address() as { port: number };
    const started = Date.now();

    await withSettings({ SMTP_PORT: String(port) }, async () => {
      await expect(sendLoginEmail({ to: address(), url: LINK })).rejects.toThrow();
    });

    expect(Date.now() - started).toBeLessThan(12_000);
  }, 20_000);
});
