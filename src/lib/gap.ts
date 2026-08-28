import type { SkillGraph } from "./graph";
import { levelToMastery, masteryOf } from "./mastery";
import type { Gap, GapEntry, MasteryVector, SkillId, SkillRef } from "./types";

/**
 * Goal-state delta: what the learner still needs, expanded over the DAG.
 *
 * This is the object retrieval and planning are driven by, and the reason the
 * system does not simply search the learner's sentence. A goal describes a
 * destination; the gap describes the journey, and the journey is what a course
 * catalogue can actually be matched against.
 */

/**
 * A prerequisite is needed at working competence, or at the level of the skill
 * that depends on it if that is lower. You do not need to master algebra to
 * dabble in statistics, but you cannot skip it either.
 */
export const PREREQ_WORKING_LEVEL = 3;

/** How much a prerequisite matters relative to the goal skill it supports. */
const DEPTH_DECAY = 0.6;
const MIN_WEIGHT = 0.15;

export interface GapOptions {
  /** Skills at or above target are dropped. Set false to inspect the full target state. */
  onlyUnmet?: boolean;
}

export function computeGap(
  goalSkills: SkillRef[],
  mastery: MasteryVector,
  graph: SkillGraph,
  options: GapOptions = {},
): Gap {
  const onlyUnmet = options.onlyUnmet ?? true;

  // Highest target wins when a skill is reached by several routes.
  const targets = new Map<
    SkillId,
    { level: number; weight: number; isGoal: boolean }
  >();

  const raise = (
    skillId: SkillId,
    level: number,
    weight: number,
    isGoal: boolean,
  ) => {
    const existing = targets.get(skillId);
    if (!existing) {
      targets.set(skillId, { level, weight, isGoal });
      return;
    }
    targets.set(skillId, {
      level: Math.max(existing.level, level),
      weight: Math.max(existing.weight, weight),
      isGoal: existing.isGoal || isGoal,
    });
  };

  for (const goal of goalSkills) {
    if (!graph.has(goal.skillId)) continue;
    raise(goal.skillId, goal.level, 1, true);

    for (const ancestor of graph.ancestors(goal.skillId)) {
      const depth = graph.depthTo(goal.skillId, ancestor);
      const level = Math.min(goal.level, PREREQ_WORKING_LEVEL);
      const weight = Math.max(MIN_WEIGHT, DEPTH_DECAY ** Math.max(depth, 1));
      raise(ancestor, level, weight, false);
    }
  }

  const gap: GapEntry[] = [];
  for (const [skillId, t] of targets) {
    const current = masteryOf(mastery, skillId);
    const target = levelToMastery(t.level);
    if (onlyUnmet && current >= target - 1e-6) continue;
    gap.push({ skillId, current, target, weight: t.weight, isGoal: t.isGoal });
  }

  // Goal skills first, then by how much is missing — this is the order the UI
  // shows the learner their gap in.
  gap.sort((a, b) => {
    if (a.isGoal !== b.isGoal) return a.isGoal ? -1 : 1;
    return (
      (b.target - b.current) * b.weight - (a.target - a.current) * a.weight
    );
  });
  return gap;
}

/** Total weighted distance to the goal state. Zero means the goal is reached. */
export function gapMagnitude(gap: Gap): number {
  return gap.reduce(
    (sum, g) => sum + g.weight * Math.max(0, g.target - g.current),
    0,
  );
}

/**
 * Gap skills the learner could start on right now: everything they depend on is
 * already held, or is being covered earlier in the path. This is the set the
 * retriever searches over, which is how the DAG shapes retrieval instead of
 * filtering it afterwards.
 */
export function frontier(
  gap: Gap,
  mastery: MasteryVector,
  graph: SkillGraph,
): Gap {
  const ready = gap.filter((entry) =>
    graph.directPrereqs(entry.skillId).every((p) => {
      const needed = levelToMastery(Math.min(PREREQ_WORKING_LEVEL, 5));
      return masteryOf(mastery, p) + 1e-6 >= needed;
    }),
  );
  // A learner far from every goal can have an empty frontier only if the graph
  // is disconnected from their state; fall back to the deepest prerequisites so
  // planning always has somewhere to start.
  if (ready.length > 0) return ready;

  const deepest = gap.filter(
    (entry) => graph.directPrereqs(entry.skillId).length === 0,
  );
  return deepest.length > 0 ? deepest : gap;
}

/**
 * A short structured description of the need, for the dense retriever. We embed
 * this rather than the learner's sentence so the query vector describes what
 * they must acquire, in the same vocabulary resource cards are written in.
 */
export function gapCard(
  gap: Gap,
  graph: SkillGraph,
  context: {
    goalText?: string;
    hoursPerWeek?: number;
    formats?: string[];
  } = {},
): string {
  const needs = gap
    .slice(0, 8)
    .map((g) => `${graph.name(g.skillId)} to level ${Math.round(g.target * 5)}`)
    .join(", ");
  const known = gap
    .filter((g) => g.current > 0)
    .slice(0, 5)
    .map(
      (g) => `${graph.name(g.skillId)} at level ${Math.round(g.current * 5)}`,
    )
    .join(", ");

  const lines = [`Needs to learn: ${needs || "foundations"}.`];
  if (known) lines.push(`Already has some: ${known}.`);
  if (context.goalText) lines.push(`Goal: ${context.goalText}`);
  if (context.hoursPerWeek)
    lines.push(`Available: about ${context.hoursPerWeek} hours per week.`);
  if (context.formats?.length)
    lines.push(`Prefers: ${context.formats.join(", ")}.`);
  return lines.join("\n");
}
