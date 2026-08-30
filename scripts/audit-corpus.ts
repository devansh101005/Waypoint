/**
 * Corpus quality audit.
 *
 *   npm run audit -- data/live
 *
 * Validation asks whether the sheet is well-formed. This asks whether it is any
 * good: can the planner actually reach the goals people wrote, is every skill
 * teachable, do the human expert paths obey their own prerequisites, and is the
 * coverage deep enough that a demo does not fall off the edge of it.
 *
 * Nothing here writes anything. It is a report to hand back to whoever owns the
 * sheet.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseResources, parseScenarios, parseSkills } from "../src/lib/corpus";
import { computeGap } from "../src/lib/gap";
import { buildGraph } from "../src/lib/graph";
import { buildMastery } from "../src/lib/mastery";
import { findPrereqViolations, planPath } from "../src/lib/planner";
import { scoreResource } from "../src/lib/scoring";
import type { Resource, ScoreBreakdown, SkillRef } from "../src/lib/types";

function pick(dir: string, names: string[]): string {
  for (const name of names) {
    const candidate = path.join(dir, name);
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      /* try the next spelling */
    }
  }
  throw new Error(`None of ${names.join(", ")} found in ${dir}`);
}

const dir = process.argv[2] ?? path.join("data", "live");

const skillsResult = parseSkills(
  readFileSync(pick(dir, ["skills.csv", "Skills.csv"]), "utf8"),
);
const skillIds = new Set(skillsResult.rows.map((s) => s.id));
const resourcesResult = parseResources(
  readFileSync(pick(dir, ["resources.csv", "Resources.csv"]), "utf8"),
  skillIds,
);
const resourceIds = new Set(resourcesResult.rows.map((r) => r.id));
const scenariosResult = parseScenarios(
  readFileSync(pick(dir, ["scenarios.csv", "Scenarios.csv"]), "utf8"),
  skillIds,
  resourceIds,
);

const graph = buildGraph(skillsResult.rows);
const resources = resourcesResult.rows;

const problems: string[] = [];
const notes: string[] = [];

console.log(`\nCORPUS AUDIT — ${dir}`);
console.log(
  `${skillsResult.rows.length} skills · ${resources.length} resources · ${scenariosResult.rows.length} scenarios\n`,
);

// ---------- 1. can every skill be learned at all? ----------

const taughtAt = new Map<string, number>();
for (const r of resources) {
  for (const t of r.teaches) {
    taughtAt.set(t.skillId, Math.max(taughtAt.get(t.skillId) ?? 0, t.level));
  }
}

const untaught = skillsResult.rows.filter((s) => !taughtAt.has(s.id));
console.log("1. TEACHABILITY");
console.log(
  `   skills with at least one resource: ${taughtAt.size}/${skillsResult.rows.length}`,
);
if (untaught.length > 0) {
  console.log(
    `   ✖ ${untaught.length} skill(s) nothing teaches — a path can never pass through these:`,
  );
  for (const s of untaught)
    console.log(`       ${s.id} (${s.name}, ${s.domain})`);
  problems.push(`${untaught.length} skills have no resource teaching them`);
} else {
  console.log("   ✔ every skill is taught by something");
}

// ---------- 2. is anything required but never taught high enough? ----------

const shortfalls: string[] = [];
for (const r of resources) {
  for (const req of r.requires) {
    const best = taughtAt.get(req.skillId) ?? 0;
    if (best < req.level) {
      shortfalls.push(
        `${r.id} needs ${req.skillId}:${req.level} but nothing teaches it above ${best || "0"}`,
      );
    }
  }
}
console.log("\n2. REACHABLE PREREQUISITES");
if (shortfalls.length > 0) {
  console.log(
    `   ✖ ${shortfalls.length} resource(s) require a level nothing provides:`,
  );
  for (const s of shortfalls.slice(0, 12)) console.log(`       ${s}`);
  if (shortfalls.length > 12)
    console.log(`       …and ${shortfalls.length - 12} more`);
  problems.push(
    `${shortfalls.length} resources require levels no resource teaches`,
  );
} else {
  console.log("   ✔ every required level is reachable from the corpus");
}

// ---------- 2b. how high can each skill actually be taken? ----------

/**
 * A goal is normally asked for at level 4 ("employable"). A skill whose best
 * resource stops at level 2 can never satisfy that, so the planner returns a
 * partial route and the learner is told the goal is out of reach — correct, but
 * it looks like a bug and it is really a gap in the shelf.
 */
console.log("\n2b. LEVEL CEILINGS");
const lowCeiling = [...taughtAt.entries()]
  .filter(([, level]) => level < 4)
  .map(([id, level]) => ({ id, level, name: graph.name(id) }))
  .sort((a, b) => a.level - b.level);

if (lowCeiling.length === 0) {
  console.log("   ✔ every skill can be taken to level 4 or above");
} else {
  console.log(
    `   ⚠ ${lowCeiling.length} skill(s) top out below level 4 — a goal asking for 4 there cannot complete:`,
  );
  for (const entry of lowCeiling.slice(0, 15)) {
    console.log(`       ${entry.id.padEnd(30)} best level ${entry.level}  (${entry.name})`);
  }
  if (lowCeiling.length > 15) console.log(`       …and ${lowCeiling.length - 15} more`);
  notes.push(
    `${lowCeiling.length} skills cannot reach level 4 — add a deeper resource, or expect partial routes`,
  );
}

// ---------- 3. do the experts' own paths obey prerequisites? ----------

console.log("\n3. EXPERT PATHS");
const byId = new Map(resources.map((r) => [r.id, r]));
let expertViolations = 0;

for (const scenario of scenariosResult.rows) {
  const start = buildMastery({ stated: scenario.persona.statedSkills });
  const items = scenario.expertPath
    .map((id) => byId.get(id))
    .filter((r): r is Resource => Boolean(r))
    .map((resource) => ({ resource }));

  const violations = findPrereqViolations(items, start);
  if (violations.length > 0) {
    expertViolations += violations.length;
    console.log(
      `   ⚠ ${scenario.id} (${scenario.persona.personaName}) — ${violations.length} ordering problem(s):`,
    );
    for (const v of violations.slice(0, 3)) {
      console.log(
        `       step ${v.position + 1} ${v.resourceId} needs ${v.missing.map((m) => `${m.skillId}:${m.level}`).join(", ")}`,
      );
    }
  }
}

if (expertViolations === 0) {
  console.log(
    "   ✔ every hand-written path is prerequisite-clean against its own tagging",
  );
} else {
  notes.push(
    `${expertViolations} ordering problems in expert paths — either the path or the tagging is wrong`,
  );
}

// ---------- 4. can our planner reach each scenario's goal? ----------

console.log("\n4. PLANNER REACHABILITY");
let unreachable = 0;
for (const scenario of scenariosResult.rows) {
  const goals: SkillRef[] = scenario.goalSkills ?? [];
  if (goals.length === 0) {
    console.log(`   – ${scenario.id}: no goal_skills column, skipped`);
    continue;
  }
  const mastery = buildMastery({ stated: scenario.persona.statedSkills });
  const gap = computeGap(goals, mastery, graph);
  const scores = new Map<string, ScoreBreakdown>(
    resources.map((r) => [r.id, scoreResource(r, gap)]),
  );
  const plan = planPath({
    goalSkills: goals,
    mastery,
    graph,
    resources,
    scores,
    maxItems: 14,
  });
  const flag = plan.complete ? "✔" : "✖";
  if (!plan.complete) unreachable++;
  console.log(
    `   ${flag} ${scenario.id} ${scenario.persona.personaName.padEnd(30)} ${String(plan.items.length).padStart(2)} steps · ${String(Math.round(plan.totalHours)).padStart(3)}h · ${plan.stoppedBecause}`,
  );
}
if (unreachable > 0) {
  problems.push(
    `${unreachable} scenario goal(s) the planner cannot fully reach`,
  );
}

// ---------- 5. shape of the corpus ----------

console.log("\n5. SHAPE");
const byDomain = new Map<string, number>();
for (const s of skillsResult.rows)
  byDomain.set(s.domain, (byDomain.get(s.domain) ?? 0) + 1);
console.log(
  `   domains: ${[...byDomain].map(([d, n]) => `${d} ${n}`).join(" · ")}`,
);

const byType = new Map<string, number>();
for (const r of resources) byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
console.log(
  `   types:   ${[...byType].map(([t, n]) => `${t} ${n}`).join(" · ")}`,
);

const hours = resources.map((r) => r.estHours).sort((a, b) => a - b);
const median = hours[Math.floor(hours.length / 2)];
console.log(
  `   hours:   total ${Math.round(hours.reduce((a, b) => a + b, 0))}h · median ${median}h · range ${hours[0]}–${hours.at(-1)}h`,
);

const roots = skillsResult.rows.filter(
  (s) => graph.directPrereqs(s.id).length === 0,
);
const depths = skillsResult.rows.map((s) => graph.ancestors(s.id).size);
console.log(
  `   graph:   ${roots.length} entry skills · deepest chain ${Math.max(...depths)} prerequisites · mean ${(depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(1)}`,
);

const perSkill = [...taughtAt.keys()].map(
  (id) =>
    resources.filter((r) => r.teaches.some((t) => t.skillId === id)).length,
);
const thin = [...taughtAt.keys()].filter(
  (id) =>
    resources.filter((r) => r.teaches.some((t) => t.skillId === id)).length ===
    1,
);
console.log(
  `   choice:  mean ${(perSkill.reduce((a, b) => a + b, 0) / perSkill.length).toFixed(1)} resources per skill · ${thin.length} skill(s) with only one option`,
);
if (thin.length > skillsResult.rows.length * 0.5) {
  notes.push(
    `${thin.length} skills have a single resource — struggling with it leaves nothing to swap to`,
  );
}

// ---------- verdict ----------

console.log("\nVERDICT");
if (problems.length === 0) {
  console.log("   ✔ no blocking problems — this corpus can carry the demo");
} else {
  for (const p of problems) console.log(`   ✖ ${p}`);
}
for (const n of notes) console.log(`   ⚠ ${n}`);
console.log();
