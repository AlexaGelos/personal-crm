import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { databaseConfig } from "./config";
import * as schema from "./schema";

function connect() {
  return drizzle(postgres({ ...databaseConfig(), max: 10 }), { schema });
}

type Database = ReturnType<typeof connect>;

// Reuse one connection pool across hot reloads in development
const globalForDb = globalThis as unknown as { db?: Database };

// Connects on first use, not on import: "next build" loads this module
// without database settings (the Docker image is built without .env)
export const db = new Proxy({} as Database, {
  get(_, property) {
    globalForDb.db ??= connect();
    const value = Reflect.get(globalForDb.db, property);
    return typeof value === "function" ? value.bind(globalForDb.db) : value;
  },
});
