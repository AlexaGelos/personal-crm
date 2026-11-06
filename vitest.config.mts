import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { TEST_SETTINGS } from "./src/test/test-settings";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // Same paths as "paths" in tsconfig.json
      { find: /^@\//, replacement: `${fromRoot("./src")}/` },
      { find: /^server-only$/, replacement: fromRoot("./src/test/server-only.ts") },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
    // The zone the server shows dates in (TZ in deploy/compose.yaml): due dates depend on it
    // and the settings that keep every email in the Mailpit stand-in, whatever .env says
    env: { TZ: "Europe/Moscow", ...TEST_SETTINGS },
    // One test database for everybody: the test files run one after another
    fileParallelism: false,
    globalSetup: ["./src/test/global-setup.ts"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
