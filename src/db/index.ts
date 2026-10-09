import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { databaseConfig } from "./config";
import * as schema from "./schema";

// Reuse one connection pool across hot reloads in development
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

const sql = globalForDb.sql ?? postgres({ ...databaseConfig(), max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.sql = sql;
}

export const db = drizzle(sql, { schema });
