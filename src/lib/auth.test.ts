import { afterEach, describe, expect, it, vi } from "vitest";

import { TEST_SETTINGS } from "@/test/test-settings";

// The module is loaded again for every test: the settings are read from the environment then
async function loadAuthModule() {
  vi.resetModules();
  return import("@/lib/auth");
}

function withoutSettings(names: string[]) {
  const before = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  return () => Object.assign(process.env, before);
}

describe("getAuth", () => {
  let restore: (() => void) | undefined;

  afterEach(() => {
    restore?.();
    restore = undefined;
    vi.resetModules();
  });

  it("loads without the login settings: the Docker image is built without them", async () => {
    restore = withoutSettings(["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"]);

    await expect(loadAuthModule()).resolves.toBeDefined();
  });

  it("says what is missing at the first call, not before", async () => {
    restore = withoutSettings(["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"]);
    const { getAuth } = await loadAuthModule();

    expect(() => getAuth()).toThrow(/BETTER_AUTH_SECRET.*BETTER_AUTH_URL/);
  });

  it("refuses a secret that is too short", async () => {
    process.env.BETTER_AUTH_SECRET = "short";
    restore = () => {
      process.env.BETTER_AUTH_SECRET = TEST_SETTINGS.BETTER_AUTH_SECRET;
    };
    const { getAuth } = await loadAuthModule();

    expect(() => getAuth()).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("is created once and then reused", async () => {
    const { getAuth } = await loadAuthModule();

    expect(getAuth()).toBe(getAuth());
  });

  it("is set up for 30 days of login, links valid for 15 minutes and no limit by address", async () => {
    const { getAuth } = await loadAuthModule();
    const context = await getAuth().$context;

    expect(context.sessionConfig.expiresIn).toBe(30 * 24 * 60 * 60);
    expect(context.sessionConfig.updateAge).toBe(60 * 60);
    expect(context.rateLimit.enabled).toBe(false);
  });
});
