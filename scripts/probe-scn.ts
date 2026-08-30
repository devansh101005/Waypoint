/** One-off: what does the extractor actually do with a given scenario? */
import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import Papa from "papaparse";
import { parseSkills } from "../src/lib/corpus";
import { buildGraph } from "../src/lib/graph";
import { extractIntake } from "../src/lib/intake";

config({ path: ".env.local" });

async function main() {
  const id = process.argv[2] ?? "SCN-05";
  const dir = path.join("data", "live");
  const graph = buildGraph(parseSkills(readFileSync(path.join(dir, "skills.csv"), "utf8")).rows);

  const rows = Papa.parse<Record<string, string>>(
    readFileSync(path.join(dir, "scenarios.csv"), "utf8"),
    { header: true, skipEmptyLines: "greedy" },
  ).data;
  const row = rows.find((r) => r.scenario_id === id);
  if (!row) throw new Error(`no ${id}`);

  console.log(`\n${id} — ${row.persona_name}`);
  console.log(`goal: ${row.goal}\n`);

  const result = await extractIntake(
    [{ role: "user", content: `${row.background}\n\nWhat I want: ${row.goal}` }],
    graph,
  );

  console.log("goalSkills      :", result.goalSkills.map((g) => `${g.skillId}:${g.level}`).join(", ") || "(none)");
  console.log("statedSkills    :", result.statedSkills.map((g) => `${g.skillId}:${g.level}`).join(", ") || "(none)");
  console.log("droppedSkills   :", result.droppedSkills.join(", ") || "(none)");
  console.log("followUpQuestion:", result.followUpQuestion ?? "(none)");
  console.log("ready           :", result.ready);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
