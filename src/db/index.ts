import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

declare global {
  // Reuse the connection across hot reloads in dev.
  // eslint-disable-next-line no-var
  var __waypointSql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __waypointDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

/**
 * The connection is opened on first query, not on import.
 *
 * Without this, importing anything that touches the database throws when
 * DATABASE_URL is unset — which would make the no-database mode impossible,
 * since module graphs are resolved before any store selection happens.
 */
function connect() {
  if (globalThis.__waypointDb) return globalThis.__waypointDb;

  const client =
    globalThis.__waypointSql ??
    postgres(env.databaseUrl, {
      prepare: false, // required for Supabase transaction-mode pooling
      max: 5,
    });

  const instance = drizzle(client, { schema });
  if (process.env.NODE_ENV !== "production") {
    globalThis.__waypointSql = client;
    globalThis.__waypointDb = instance;
  }
  return instance;
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

export const db = new Proxy({} as Db, {
  get(_target, property) {
    const instance = connect();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
