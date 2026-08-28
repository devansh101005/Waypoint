import { computeGap, gapMagnitude } from "./gap";
import type { SkillGraph } from "./graph";
import { levelToMastery, masteryOf, simulatePath } from "./mastery";
import { findPrereqViolations } from "./planner";
import type {
  EvalMetrics,
  MasteryVector,
  Resource,
  ResourceId,
  SkillRef,
} from "./types";

/**
 * Scoring a learning path against a human expert's answer.
 *
 * Ordinary recommendation metrics do not fit here: a learning path is judged on
 * whether it is *learnable in sequence*, not on whether its items are topically
 * relevant. So relevance metrics (nDCG) are reported alongside sequence metrics
 * (prerequisite violations, ordering correlation) and efficiency metrics
 * (coverage, redundancy, hours) — and the sequence metrics are the headline.
 */

export interface ScoredPath {
  items: Array<{ resource: Resource }>;
}

/**
 * Fraction of steps the learner was not ready for when they reached them.
 * Zero by construction for our planner; the baseline has no notion of it.
 */
export function prereqViolationRate(
  path: ScoredPath,
  startMastery: MasteryVector,
): number {
  if (path.items.length === 0) return 0;
  return (
    findPrereqViolations(path.items, startMastery).length / path.items.length
  );
}

/** How much of the learner's initial gap the path actually closes. */
export function gapCoverage(
  path: ScoredPath,
  goalSkills: SkillRef[],
  startMastery: MasteryVector,
  graph: SkillGraph,
): number {
  const before = gapMagnitude(computeGap(goalSkills, startMastery, graph));
  if (before <= 0) return 1;
  const after = gapMagnitude(
    computeGap(
      goalSkills,
      simulatePath(
        startMastery,
        path.items.map((i) => i.resource),
      ),
      graph,
    ),
  );
  return Math.max(0, Math.min(1, (before - after) / before));
}

/**
 * Share of the path's teaching effort spent on skills the learner already held
 * when they reached that step. High redundancy means wasted weeks.
 */
export function pathRedundancy(
  path: ScoredPath,
  startMastery: MasteryVector,
): number {
  let taught = 0;
  let alreadyHeld = 0;
  let mastery = { ...startMastery };

  for (const { resource } of path.items) {
    for (const t of resource.teaches) {
      const target = levelToMastery(t.level);
      taught += target;
      alreadyHeld += Math.min(target, masteryOf(mastery, t.skillId));
    }
    mastery = simulatePath(mastery, [resource]);
  }
  return taught > 0 ? alreadyHeld / taught : 0;
}

/**
 * nDCG of the system's ordering against the expert's, with linear gain.
 *
 * Gain is linear rather than exponential because expert positions are a ranking
 * of comparable items, not a relevance scale with orders of magnitude between
 * grades — exponential gain would let one lucky first pick dominate the score.
 */
export function ndcg(
  systemIds: ResourceId[],
  expertIds: ResourceId[],
  k?: number,
): number {
  if (expertIds.length === 0) return 0;
  const limit = k ?? Math.max(systemIds.length, expertIds.length);

  const relevance = new Map<ResourceId, number>();
  expertIds.forEach((id, i) =>
    relevance.set(id, (expertIds.length - i) / expertIds.length),
  );

  const dcg = (ids: ResourceId[]) =>
    ids
      .slice(0, limit)
      .reduce(
        (sum, id, i) => sum + (relevance.get(id) ?? 0) / Math.log2(i + 2),
        0,
      );

  const ideal = [...relevance.values()].sort((a, b) => b - a);
  const idcg = ideal
    .slice(0, limit)
    .reduce((sum, rel, i) => sum + rel / Math.log2(i + 2), 0);

  return idcg > 0 ? dcg(systemIds) / idcg : 0;
}

/**
 * Kendall's tau over the items both paths contain: do we order the overlap the
 * way the expert did? Returns null when fewer than two items overlap, because a
 * correlation over one point is not a number worth reporting.
 */
export function kendallTau(
  systemIds: ResourceId[],
  expertIds: ResourceId[],
): number | null {
  const expertRank = new Map<ResourceId, number>();
  expertIds.forEach((id, i) => expertRank.set(id, i));

  const common = systemIds.filter((id) => expertRank.has(id));
  if (common.length < 2) return null;

  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < common.length; i++) {
    for (let j = i + 1; j < common.length; j++) {
      const expertOrder =
        expertRank.get(common[i])! - expertRank.get(common[j])!;
      if (expertOrder === 0) continue;
      // i precedes j in the system path by construction.
      if (expertOrder < 0) concordant++;
      else discordant++;
    }
  }
  const pairs = concordant + discordant;
  return pairs > 0 ? (concordant - discordant) / pairs : null;
}

export function totalHours(path: ScoredPath): number {
  return (
    Math.round(
      path.items.reduce((sum, i) => sum + i.resource.estHours, 0) * 10,
    ) / 10
  );
}

export function evaluatePath(
  system: string,
  path: ScoredPath,
  input: {
    goalSkills: SkillRef[];
    startMastery: MasteryVector;
    graph: SkillGraph;
    expertPath: ResourceId[];
  },
): EvalMetrics & { kendallTau: number } {
  const ids = path.items.map((i) => i.resource.id);
  const tau = kendallTau(ids, input.expertPath);

  return {
    system,
    prereqViolationRate: round(prereqViolationRate(path, input.startMastery)),
    gapCoverage: round(
      gapCoverage(path, input.goalSkills, input.startMastery, input.graph),
    ),
    redundancy: round(pathRedundancy(path, input.startMastery)),
    ndcg: round(ndcg(ids, input.expertPath)),
    kendallTau: round(tau ?? 0),
    totalHours: totalHours(path),
  };
}

/** Average each metric across scenarios, so one scenario cannot dominate. */
export function macroAverage(rows: EvalMetrics[]): EvalMetrics {
  const n = rows.length || 1;
  const sum = (pick: (m: EvalMetrics) => number) =>
    rows.reduce((a, m) => a + pick(m), 0) / n;
  return {
    system: rows[0]?.system ?? "unknown",
    prereqViolationRate: round(sum((m) => m.prereqViolationRate)),
    gapCoverage: round(sum((m) => m.gapCoverage)),
    redundancy: round(sum((m) => m.redundancy)),
    ndcg: round(sum((m) => m.ndcg)),
    kendallTau: round(sum((m) => m.kendallTau)),
    totalHours: round(sum((m) => m.totalHours)),
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
