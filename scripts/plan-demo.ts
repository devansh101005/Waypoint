/**
 * Plan a path against the local bootstrap corpus, with no database.
 *
 *   npm run plan -- "sql-window-functions:4,dashboarding:3" --known "sql-basics:3" --hours 60
 *
 * Exists so the planner can be exercised end-to-end against the real corpus
 * before any infrastructure is up, and so a failing scenario can be reproduced
 * on the command line rather than through the UI.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseResources, parseSkills } from "../src/lib/corpus";
import { computeGap } from "../src/lib/gap";
import { buildGraph } from "../src/lib/graph";
import { buildMastery, masteryToLevel } from "../src/lib/mastery";
import { findPrereqViolations, planPath } from "../src/lib/planner";
import { scoreResource } from "../src/lib/scoring";
import type { ScoreBreakdown, SkillRef } from "../src/lib/types";

function parseRefs(input: string): SkillRef[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((token) => {
      const [skillId, level] = token.split(":");
      return { skillId: skillId.trim(), level: Number(level ?? 3) };
    });
}

function flag(name: string, fallback = ""): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const goalArg = process.argv[2];
if (!goalArg || goalArg.startsWith("--")) {
  console.error(
    'Usage: npm run plan -- "skill-slug:level,..." [--known "slug:level,..."] [--hours N] [--items N]',
  );
  process.exit(1);
}

const dir = path.join("data", "bootstrap");
const skillsResult = parseSkills(
  readFileSync(path.join(dir, "skills.csv"), "utf8"),
);
const skillIds = new Set(skillsResult.rows.map((s) => s.id));
const resourcesResult = parseResources(
  readFileSync(path.join(dir, "resources.csv"), "utf8"),
  skillIds,
);

if (skillsResult.errors.length || resourcesResult.errors.length) {
  console.error(
    "Bootstrap corpus is invalid; run `npm run import -- ... --validate-only` for details.",
  );
  process.exit(1);
}

const graph = buildGraph(skillsResult.rows);
const goalSkills = parseRefs(goalArg).filter((g) => {
  if (!graph.has(g.skillId)) {
    console.error(`Unknown skill: ${g.skillId}`);
    return false;
  }
  return true;
});
if (goalSkills.length === 0) process.exit(1);

const known = flag("known") ? parseRefs(flag("known")) : [];
const mastery = buildMastery({ stated: known });
const hourBudget = flag("hours") ? Number(flag("hours")) : Infinity;
const maxItems = flag("items") ? Number(flag("items")) : 12;

const gap = computeGap(goalSkills, mastery, graph);
const scores = new Map<string, ScoreBreakdown>(
  resourcesResult.rows.map((r) => [r.id, scoreResource(r, gap)]),
);

const plan = planPath({
  goalSkills,
  mastery,
  graph,
  resources: resourcesResult.rows,
  scores,
  hourBudget,
  maxItems,
});

console.log(
  `\nGoal: ${goalSkills.map((g) => `${graph.name(g.skillId)} @ ${g.level}`).join(", ")}`,
);
if (known.length) {
  console.log(
    `Already knows: ${known.map((k) => `${graph.name(k.skillId)} @ ${k.level}`).join(", ")}`,
  );
}
console.log(`\nGap (${gap.length} skills):`);
for (const g of gap.slice(0, 10)) {
  console.log(
    `  ${g.isGoal ? "*" : " "} ${graph.name(g.skillId).padEnd(28)} ` +
      `${masteryToLevel(g.current).toFixed(1)} → ${masteryToLevel(g.target).toFixed(1)}  (weight ${g.weight.toFixed(2)})`,
  );
}

console.log(
  `\nPath (${plan.items.length} steps, ${plan.totalHours}h, ${plan.stoppedBecause}):`,
);
plan.items.forEach((item, i) => {
  const covers = item.reasons.coversGapSkills
    .map((c) => `${c.name} ${c.fromLevel}→${c.toLevel}`)
    .join(", ");
  console.log(`  ${String(i + 1).padStart(2)}. ${item.resource.title}`);
  console.log(
    `      ${item.resource.estHours}h · difficulty ${item.resource.difficulty} · ${item.reasons.difficultyFit.verdict}`,
  );
  console.log(`      covers: ${covers || "—"}`);
  if (item.reasons.unlockedBy.length) {
    console.log(
      `      unlocked by: ${item.reasons.unlockedBy.map((u) => u.title).join(", ")}`,
    );
  }
  if (item.milestoneLabel) console.log(`      ${item.milestoneLabel}`);
});

const violations = findPrereqViolations(plan.items, mastery);
console.log(`\nPrerequisite violations: ${violations.length}`);
for (const v of violations) {
  console.log(
    `  step ${v.position + 1} (${v.resourceId}) missing ${v.missing.map((m) => m.skillId).join(", ")}`,
  );
}
if (!plan.complete) {
  console.log(
    `Remaining gap: ${plan.remainingGap.map((g) => graph.name(g.skillId)).join(", ")}`,
  );
}
console.log();
