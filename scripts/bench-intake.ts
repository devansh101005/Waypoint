/**
 * Compare models for the intake extraction: latency and whether they resolve
 * the same skills. Intake is on the critical path of the demo, so its model is
 * chosen on measurements rather than on which one sounds best.
 *
 *   npm run bench:intake
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { parseSkills } from "../src/lib/corpus";
import { buildGraph } from "../src/lib/graph";
import { extractIntake } from "../src/lib/intake";
import type { ModelRole } from "../src/lib/llm";

config({ path: ".env.local" });

const CASES = [
  "I'm a commerce graduate and I only really know Excel. I want to become a data analyst and be employable in about six months. I can study around 10 hours a week.",
  "I already know Python and pandas from a class project. I want to learn machine learning properly, not just call fit and predict.",
  "I want to build websites. Complete beginner, but I have a free summer.",
];

async function main() {
  const dir = path.join("data", "bootstrap");
  const skills = parseSkills(
    readFileSync(path.join(dir, "skills.csv"), "utf8"),
  );
  const graph = buildGraph(skills.rows);

  for (const role of ["primary", "fast"] as ModelRole[]) {
    console.log(`\n=== ${role} ===`);
    let total = 0;
    for (const [i, message] of CASES.entries()) {
      const started = Date.now();
      try {
        const result = await extractIntake(
          [{ role: "user", content: message }],
          graph,
          { role },
        );
        const ms = Date.now() - started;
        total += ms;
        console.log(
          `  case ${i + 1}: ${(ms / 1000).toFixed(1)}s  ready=${result.ready}  ` +
            `goals=[${result.goalSkills.map((g) => `${g.skillId}:${g.level}`).join(", ")}]`,
        );
        if (result.statedSkills.length) {
          console.log(
            `            knows=[${result.statedSkills.map((s) => s.skillId).join(", ")}]`,
          );
        }
        if (result.droppedSkills.length) {
          console.log(
            `            dropped=[${result.droppedSkills.join(", ")}]`,
          );
        }
      } catch (error) {
        console.log(
          `  case ${i + 1}: FAILED ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    console.log(`  average: ${(total / CASES.length / 1000).toFixed(1)}s`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
