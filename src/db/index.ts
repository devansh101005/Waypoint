import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

declare global {
  // Reuse the connection across hot reloads in dev.
  // eslint-disable-next-line no-var
  var __waypointSql: ReturnType<typeof postgres> | undefined;
}

const client =
  globalThis.__waypointSql ??
  postgres(env.databaseUrl, {
    prepare: false, // required for Supabase transaction-mode pooling
    max: 5,
  });

if (process.env.NODE_ENV !== "production") globalThis.__waypointSql = client;

export const db = drizzle(client, { schema });
export { schema };
