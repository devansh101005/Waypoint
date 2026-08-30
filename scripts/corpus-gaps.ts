import { readFileSync } from "node:fs";
import { parseResources, parseSkills } from "../src/lib/corpus";

/**
 * The corpus audit says *how many* skills are thin. This says *which ones*, in
 * the form a curator needs: the skill, what currently teaches it, and how far
 * that gets a learner. `npm run audit` truncates its lists; this does not.
 */

const skills = parseSkills(readFileSync("data/live/skills.csv", "utf8"));
const skillIds = new Set(skills.rows.map((s) => s.id));
const resources = parseResources(
  readFileSync("data/live/resources.csv", "utf8"),
  skillIds,
);

const ceiling = new Map<string, number>();
const teachers = new Map<string, string[]>();
for (const r of resources.rows) {
  for (const t of r.teaches) {
    ceiling.set(t.skillId, Math.max(ceiling.get(t.skillId) ?? 0, t.level));
    teachers.set(t.skillId, [
      ...(teachers.get(t.skillId) ?? []),
      `${r.id}@${t.level}`,
    ]);
  }
}

const capped = skills.rows
  .filter((s) => (ceiling.get(s.id) ?? 0) < 4)
  .sort(
    (a, b) =>
      (ceiling.get(a.id) ?? 0) - (ceiling.get(b.id) ?? 0) ||
      a.domain.localeCompare(b.domain),
  );

console.log(`CAPPED BELOW LEVEL 4 — ${capped.length} of ${skills.rows.length}`);
for (const s of capped) {
  const t = teachers.get(s.id) ?? [];
  console.log(
    `  ceil ${ceiling.get(s.id) ?? 0}  ${s.domain.padEnd(13)} ${s.id.padEnd(30)} ${t.length} res [${t.join(" ")}]`,
  );
}

const thin = skills.rows.filter((s) => (teachers.get(s.id) ?? []).length === 1);
console.log(`\nSINGLE RESOURCE — ${thin.length}`);
for (const s of thin) {
  console.log(
    `  ceil ${ceiling.get(s.id) ?? 0}  ${s.domain.padEnd(13)} ${s.id.padEnd(30)} [${(teachers.get(s.id) ?? []).join(" ")}]`,
  );
}

const ids = resources.rows.map((r) => r.id).sort();
console.log(`\nRESOURCES ${resources.rows.length} · highest id ${ids.at(-1)}`);
