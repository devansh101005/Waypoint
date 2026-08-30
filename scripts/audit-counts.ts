import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

config({ path: ".env.local" });

async function main() {
  const [row] = await db.execute<{
    skills: number; resources: number; scenarios: number; embedded: number; learners: number; paths: number;
  }>(sql`
    select
      (select count(*) from skills)::int          as skills,
      (select count(*) from resources)::int       as resources,
      (select count(*) from eval_scenarios)::int  as scenarios,
      (select count(*) from resources where embedding is not null)::int as embedded,
      (select count(*) from learners)::int        as learners,
      (select count(*) from paths)::int           as paths
  `);
  console.log("DATABASE:", JSON.stringify(row, null, 2));
  process.exit(0);
}
main().catch((e) => { console.error("db check failed:", e instanceof Error ? e.message : e); process.exit(1); });
