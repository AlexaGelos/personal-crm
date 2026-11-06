// Applies the migrations from ./drizzle, passing the owner's email to the one that gives the
// existing data an owner (0003_login.sql reads it as the setting "app.owner_email").
// Shared by pnpm db:migrate, the one-off migration container on the server and the tests
import { sql as rawSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type postgres from "postgres";

export async function runMigrations(
  sql: postgres.Sql,
  { ownerEmail, migrationsFolder = "drizzle" }: { ownerEmail?: string; migrationsFolder?: string },
) {
  const db = drizzle(sql);

  // The setting lives as long as the connection, so the connection must be the only one (max: 1):
  // the migration then reads it on the same connection. Not set - the migration finds no email
  if (ownerEmail)
    await db.execute(rawSql`select set_config('app.owner_email', ${ownerEmail}, false)`);

  await migrate(db, { migrationsFolder });
}
