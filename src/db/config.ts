import { existsSync } from "node:fs";

// Scripts run outside Next.js read .env themselves; in a container the settings
// are already in the environment and there is no .env file
export function loadLocalEnv() {
  if (existsSync(".env")) process.loadEnvFile(".env");
}

// Connection settings come from the same .env variables that compose.yaml uses
export function databaseConfig() {
  const { POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_PORT } =
    process.env;

  if (!POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB) {
    throw new Error(
      "Database settings are missing: set POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB in .env",
    );
  }

  return {
    // Locally compose.yaml publishes the port on 127.0.0.1 only ("localhost" may resolve
    // to IPv6 first); on the server the app reaches the database container by its name
    host: POSTGRES_HOST || "127.0.0.1",
    port: Number(POSTGRES_PORT || 5432),
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    database: POSTGRES_DB,
  };
}
