// Connection settings come from the same .env variables that compose.yaml uses
export function databaseConfig() {
  const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_PORT } =
    process.env;

  if (!POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB) {
    throw new Error(
      "Database settings are missing: set POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB in .env",
    );
  }

  return {
    // compose.yaml publishes the port on 127.0.0.1 only; "localhost" may resolve to IPv6 first
    host: "127.0.0.1",
    port: Number(POSTGRES_PORT || 5432),
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    database: POSTGRES_DB,
  };
}
