/**
 * Idempotent schema top-ups.
 *
 *   npm run db:migrate
 *
 * `drizzle-kit push` creates the schema from scratch correctly, but it asks for
 * confirmation interactively and does nothing when run without a terminal — so
 * columns added after the first push need an explicit, re-runnable step. Every
 * statement here is safe to run repeatedly and must stay in step with
 * src/db/schema.ts, which remains the source of truth.
 */
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

config({ path: ".env.local" });

const STATEMENTS: Array<{ describe: string; run: () => Promise<unknown> }> = [
  {
    describe: "learners.goal_summary",
    run: () =>
      db.execute(
        sql`ALTER TABLE learners ADD COLUMN IF NOT EXISTS goal_summary text NOT NULL DEFAULT ''`,
      ),
  },
  {
    describe: "learners.goal_skills",
    run: () =>
      db.execute(
        sql`ALTER TABLE learners ADD COLUMN IF NOT EXISTS goal_skills jsonb NOT NULL DEFAULT '[]'::jsonb`,
      ),
  },
  {
    describe: "learners.stated_skills",
    run: () =>
      db.execute(
        sql`ALTER TABLE learners ADD COLUMN IF NOT EXISTS stated_skills jsonb NOT NULL DEFAULT '[]'::jsonb`,
      ),
  },
  {
    describe: "paths.total_hours",
    run: () =>
      db.execute(
        sql`ALTER TABLE paths ADD COLUMN IF NOT EXISTS total_hours real NOT NULL DEFAULT 0`,
      ),
  },
  {
    describe: "paths.complete",
    run: () =>
      db.execute(
        sql`ALTER TABLE paths ADD COLUMN IF NOT EXISTS complete boolean NOT NULL DEFAULT false`,
      ),
  },
  {
    describe: "index on paths.learner_id",
    run: () =>
      db.execute(
        sql`CREATE INDEX IF NOT EXISTS paths_learner_idx ON paths (learner_id)`,
      ),
  },
  {
    describe: "index on events.learner_id",
    run: () =>
      db.execute(
        sql`CREATE INDEX IF NOT EXISTS events_learner_idx ON events (learner_id)`,
      ),
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Nothing to migrate.");
    process.exit(1);
  }

  for (const statement of STATEMENTS) {
    await statement.run();
    console.log(`  ok  ${statement.describe}`);
  }

  const columns = await db.execute<{
    table_name: string;
    column_name: string;
  }>(sql`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public'
      and ((table_name = 'learners' and column_name in ('goal_summary','goal_skills','stated_skills'))
        or (table_name = 'paths'    and column_name in ('total_hours','complete')))
  `);

  if (columns.length !== 5) {
    console.error(
      `\n✖ Expected 5 columns, found ${columns.length}. Schema is not in the state the app expects.`,
    );
    process.exit(1);
  }

  console.log("\n✔ Schema is up to date.");
  process.exit(0);
}

main().catch((error) => {
  console.error(
    "\n✖ Migration failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
