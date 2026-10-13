import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/db";

// Smoke check for deploys: the app is up and can reach the database.
// If the query fails, Next.js answers 500
export async function GET() {
  // Always answer at request time, never from a build-time prerender
  await connection();
  await db.execute(sql`select 1`);
  return Response.json({ status: "ok" });
}
