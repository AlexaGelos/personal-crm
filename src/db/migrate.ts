// Applies pending migrations from ./drizzle. On the server the deploy runs it
// in a one-off container before the new app version starts (deploy/deploy.sh).
// OWNER_EMAIL: the user who gets all the data that existed before login (migration 0003);
// it is only read while that migration runs, and may be absent on an empty database
import postgres from "postgres";

import { databaseConfig, loadLocalEnv } from "./config";
import { runMigrations } from "./run-migrations";

async function main() {
  loadLocalEnv();
  // One connection: the owner's email is a setting of this very connection
  const sql = postgres({ ...databaseConfig(), max: 1, onnotice: () => {} });

  try {
    await runMigrations(sql, { ownerEmail: process.env.OWNER_EMAIL });
    console.log("Migrations are up to date.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
