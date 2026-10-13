// Applies pending migrations from ./drizzle. On the server the deploy runs it
// in a one-off container before the new app version starts (deploy/deploy.sh)
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { databaseConfig, loadLocalEnv } from "./config";

async function main() {
  loadLocalEnv();
  const sql = postgres({ ...databaseConfig(), max: 1, onnotice: () => {} });

  try {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
    console.log("Migrations are up to date.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
