import { defineConfig } from "drizzle-kit";

import { databaseConfig } from "./src/db/config";

process.loadEnvFile(".env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { ...databaseConfig(), ssl: false },
});
