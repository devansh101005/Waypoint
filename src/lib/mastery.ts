import type { SkillGraph } from "./graph";
import type { MasteryVector, Resource, SkillId, SkillRef } from "./types";

/**
 * The learner's skill state, and the rules that move it.
 *
 * Mastery is a single number in [0,1] per skill. Updates are deliberately
 * rule-based rather than learned: with no interaction data to train on, a
 * transparent rule the system can explain out loud beats an opaque estimate,
 * and every update is replayable from the event log.
 */

export const MAX_LEVEL = 5;

/** Levels (1..5, how the corpus is tagged) <-> mastery (0..1, how we compute). */
export function levelToMastery(level: number): number {
  return clamp01(level / MAX_LEVEL);
}

export function masteryToLevel(mastery: number): number {
  return clamp01(mastery) * MAX_LEVEL;
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function masteryOf(vector: MasteryVector, skillId: SkillId): number {
  return vector[skillId] ?? 0;
}

/** Does the learner meet a required skill level? */
export function meets(
  vector: MasteryVector,
  req: SkillRef,
  epsilon = 1e-6,
): boolean {
  return masteryOf(vector, req.skillId) + epsilon >= levelToMastery(req.level);
}

/**
 * Build the starting mastery vector.
 *
 * A completed course confers exactly the levels it is tagged as teaching — the
 * tag is the claim, so honouring it keeps targets reachable. (Discounting the
 * gain by course quality was tried and removed: it made a level-4 target
 * unreachable from a level-4 course, so no path could ever complete. Quality
 * belongs in *which* resource gets picked, and lives in the scoring prior.)
 * Stated skills are taken at face value; the placement quiz corrects them.
 */
export function buildMastery(input: {
  stated?: SkillRef[];
  completed?: Resource[];
}): MasteryVector {
  const vector: MasteryVector = {};

  for (const s of input.stated ?? []) {
    vector[s.skillId] = Math.max(
      masteryOf(vector, s.skillId),
      levelToMastery(s.level),
    );
  }

  for (const course of input.completed ?? []) {
    for (const t of course.teaches) {
      vector[t.skillId] = Math.max(
        masteryOf(vector, t.skillId),
        levelToMastery(t.level),
      );
    }
  }

  return vector;
}

/**
 * Mastery implied by finishing a resource. Used both for real completions and
 * for simulating a candidate step during planning, so the planner's view of the
 * future matches what actually happens on completion.
 */
export function applyCompletion(
  vector: MasteryVector,
  resource: Resource,
): MasteryVector {
  const next = { ...vector };
  for (const t of resource.teaches) {
    next[t.skillId] = Math.max(
      masteryOf(next, t.skillId),
      levelToMastery(t.level),
    );
  }
  return next;
}

/**
 * The learner struggled with a resource: our estimate of its *prerequisites*
 * was too optimistic. Knock those down so the replan inserts remediation, and
 * leave what the resource teaches alone — they did not learn it.
 */
export function applyStruggle(
  vector: MasteryVector,
  resource: Resource,
): MasteryVector {
  const next = { ...vector };
  const targets =
    resource.requires.length > 0 ? resource.requires : resource.teaches;
  for (const r of targets) {
    next[r.skillId] = clamp01(masteryOf(next, r.skillId) * 0.6);
  }
  return next;
}

export function applyQuiz(
  vector: MasteryVector,
  skillId: SkillId,
  correct: boolean,
): MasteryVector {
  const delta = correct ? 0.15 : -0.15;
  return { ...vector, [skillId]: clamp01(masteryOf(vector, skillId) + delta) };
}

/**
 * Evidence flows down the graph: someone who can do an advanced skill must have
 * some command of what it is built on, even if they never declared it. Applied
 * as a floor so it can only ever raise an unstated prerequisite, never lower a
 * measured one.
 */
export function propagateDownward(
  vector: MasteryVector,
  graph: SkillGraph,
  factor = 0.5,
): MasteryVector {
  const next = { ...vector };
  for (const skillId of Object.keys(vector)) {
    const m = masteryOf(vector, skillId);
    if (m <= 0) continue;
    for (const ancestor of graph.ancestors(skillId)) {
      next[ancestor] = Math.max(masteryOf(next, ancestor), clamp01(m * factor));
    }
  }
  return next;
}

/** Simulate the learner state after completing a sequence of resources. */
export function simulatePath(
  start: MasteryVector,
  resources: Resource[],
): MasteryVector {
  return resources.reduce(applyCompletion, start);
}
