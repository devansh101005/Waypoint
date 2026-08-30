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

/** Deliberately spans narrow task -> subject area -> full career. */
const CASES = [
  {
    scope: "one task",
    text: "I just need to build one dashboard for my team at work. Nothing more than that.",
  },
  {
    scope: "subject area",
    text: "I already know Python and pandas. I want to learn machine learning properly, not just call fit and predict.",
  },
  {
    scope: "career",
    text: "I'm a commerce graduate and I only know Excel. I want to become a data analyst and be employable in about six months.",
  },
  {
    scope: "career",
    text: "I want to become a front-end developer and build things I can actually show people. Complete beginner.",
  },
];

async function main() {
  const dir = path.join("data", "live");
  const skills = parseSkills(
    readFileSync(path.join(dir, "skills.csv"), "utf8"),
  );
  const graph = buildGraph(skills.rows);

  const role: ModelRole = "primary";
  console.log(`
GOAL RESOLUTION — model role: ${role}
`);

  for (const [i, testCase] of CASES.entries()) {
    const started = Date.now();
    try {
      const result = await extractIntake(
        [{ role: "user", content: testCase.text }],
        graph,
        { role },
      );
      const levels = result.goalSkills.map((g) => g.level);
      const spread = levels.length
        ? `L${Math.min(...levels)}${Math.min(...levels) === Math.max(...levels) ? "" : `-L${Math.max(...levels)}`}`
        : "—";
      console.log(
        `${String(i + 1)}. [${testCase.scope.padEnd(13)}] ${result.goalSkills.length} skill(s) at ${spread}  (${((Date.now() - started) / 1000).toFixed(0)}s)`,
      );
      console.log(
        `   ${result.goalSkills.map((g) => `${g.skillId}:${g.level}`).join(", ") || "none"}`,
      );
    } catch (error) {
      console.log(`${i + 1}. FAILED ${error instanceof Error ? error.message : error}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
