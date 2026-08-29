import { computeGap, gapMagnitude } from "./gap";
import type { SkillGraph } from "./graph";
import {
  applyCompletion,
  levelToMastery,
  masteryOf,
  masteryToLevel,
  meets,
} from "./mastery";
import type {
  Gap,
  MasteryVector,
  Reasons,
  Resource,
  ScoreBreakdown,
  SkillRef,
} from "./types";

/**
 * Path generation as constrained search, not ranking.
 *
 * The prerequisite DAG gates which resources are *generated* as candidates at
 * each step, rather than filtering an already-ranked list afterwards. That
 * difference is the whole point: post-filtering collapses precisely when the
 * learner is far from their goal, because every high-similarity item is one
 * they are not ready for. Here, an infeasible step is never considered, so a
 * prerequisite violation cannot appear in the output.
 */

export interface PlanOptions {
  goalSkills: SkillRef[];
  mastery: MasteryVector;
  graph: SkillGraph;
  resources: Resource[];
  /** Retrieval scores by resource id; acts as a prior, never overrides feasibility. */
  scores?: Map<string, ScoreBreakdown>;
  hourBudget?: number;
  maxItems?: number;
  beamWidth?: number;
  /** Set false for the ablation that shows what the DAG constraint is worth. */
  enforcePrerequisites?: boolean;
  /**
   * Resources to keep out of the plan — a learner who struggled with one should
   * be offered a different route to the same skill, not the same course again.
   */
  excludeResourceIds?: string[];
}

export interface PlannedItem {
  resource: Resource;
  reasons: Reasons;
  milestoneLabel: string | null;
}

export interface PlanResult {
  items: PlannedItem[];
  totalHours: number;
  /** Gap left when planning stopped — non-empty means the goal needs more than the budget. */
  remainingGap: Gap;
  complete: boolean;
  stoppedBecause: "goal-reached" | "hour-budget" | "max-items" | "no-progress";
}

const REDUNDANCY_PENALTY = 0.8;
/** Learning is most efficient just above current competence. */
const ZONE_WIDTH = 2;

interface BeamState {
  items: PlannedItem[];
  mastery: MasteryVector;
  hours: number;
  score: number;
  used: Set<string>;
}

export function planPath(options: PlanOptions): PlanResult {
  const {
    goalSkills,
    graph,
    resources,
    scores,
    hourBudget = Infinity,
    maxItems = 12,
    beamWidth = 3,
    enforcePrerequisites = true,
    excludeResourceIds = [],
  } = options;
  const excluded = new Set(excludeResourceIds);

  let beam: BeamState[] = [
    {
      items: [],
      mastery: { ...options.mastery },
      hours: 0,
      score: 0,
      used: new Set(),
    },
  ];
  /**
   * States that reached the goal or ran out of moves. They must be kept rather
   * than dropped: a branch that finishes in two steps produces no expansions,
   * and without this pool it would lose to a longer branch that happens to
   * still be growing — returning a path with hours the learner did not need.
   */
  const settled: BeamState[] = [];
  let budgetBlocked = false;

  for (let step = 0; step < maxItems; step++) {
    const expansions: BeamState[] = [];

    for (const state of beam) {
      const gap = computeGap(goalSkills, state.mastery, graph);
      if (gap.length === 0) {
        settled.push(state);
        continue;
      }

      const candidates = feasibleCandidates(
        resources,
        state,
        enforcePrerequisites,
        excluded,
      );
      const ranked = candidates
        .map((resource) => ({
          resource,
          utility: stepUtility(resource, gap, state, scores),
        }))
        .filter((c) => c.utility > 1e-9)
        .sort((a, b) => b.utility - a.utility)
        .slice(0, Math.max(beamWidth * 2, 5));

      let expanded = 0;
      for (const { resource, utility } of ranked) {
        if (state.hours + resource.estHours > hourBudget) {
          budgetBlocked = true;
          continue;
        }
        expansions.push(
          advance(state, resource, gap, graph, goalSkills, utility, scores),
        );
        expanded++;
      }
      if (expanded === 0) settled.push(state);
    }

    if (expansions.length === 0) break;

    expansions.sort((a, b) => b.score - a.score);
    beam = expansions.slice(0, beamWidth);
  }

  const best = pickBest([...beam, ...settled], goalSkills, graph);
  const remainingGap = computeGap(goalSkills, best.mastery, graph);

  let stoppedBecause: PlanResult["stoppedBecause"];
  if (remainingGap.length === 0) stoppedBecause = "goal-reached";
  else if (budgetBlocked) stoppedBecause = "hour-budget";
  else if (best.items.length >= maxItems) stoppedBecause = "max-items";
  else stoppedBecause = "no-progress";

  return {
    items: best.items,
    totalHours: round(best.hours),
    remainingGap,
    complete: remainingGap.length === 0,
    stoppedBecause,
  };
}

/** The DAG constraint: only what the learner is ready for right now. */
function feasibleCandidates(
  resources: Resource[],
  state: BeamState,
  enforce: boolean,
  excluded: Set<string>,
): Resource[] {
  return resources.filter((r) => {
    if (state.used.has(r.id) || excluded.has(r.id)) return false;
    if (!enforce) return true;
    return r.requires.every((req) => meets(state.mastery, req));
  });
}

/**
 * Marginal mastery gained toward the goal, per hour spent, discounted for
 * material the learner already knows and for difficulty outside their zone.
 */
export function stepUtility(
  resource: Resource,
  gap: Gap,
  state: BeamState,
  scores?: Map<string, ScoreBreakdown>,
): number {
  const closure = gapClosure(resource, gap, state.mastery);
  if (closure <= 0) return 0;

  const perHour = closure / Math.max(resource.estHours, 0.5);
  const fit = difficultyFit(resource, state.mastery);
  const redundancyFactor =
    1 - REDUNDANCY_PENALTY * redundancy(resource, state.mastery);
  const retrieval = scores?.get(resource.id)?.total;
  const prior = retrieval === undefined ? 1 : 0.7 + 0.3 * retrieval;

  return perHour * fit * redundancyFactor * prior;
}

/** Weighted mastery this resource adds toward the goal state. */
export function gapClosure(
  resource: Resource,
  gap: Gap,
  mastery: MasteryVector,
): number {
  const after = applyCompletion(mastery, resource);
  let total = 0;
  for (const g of gap) {
    const gained =
      Math.min(masteryOf(after, g.skillId), g.target) -
      Math.min(g.current, g.target);
    if (gained > 0) total += g.weight * gained;
  }
  return total;
}

/** 1.0 just above current competence, decaying for too-easy and too-hard. */
export function difficultyFit(
  resource: Resource,
  mastery: MasteryVector,
): number {
  const levels = resource.teaches.map((t) =>
    masteryToLevel(masteryOf(mastery, t.skillId)),
  );
  const learnerLevel = levels.length
    ? levels.reduce((a, b) => a + b, 0) / levels.length
    : 0;
  const ideal = learnerLevel + 1;
  return Math.exp(-((resource.difficulty - ideal) ** 2) / ZONE_WIDTH ** 2);
}

/** Share of what this teaches that the learner already has. */
export function redundancy(resource: Resource, mastery: MasteryVector): number {
  let taught = 0;
  let held = 0;
  for (const t of resource.teaches) {
    const target = levelToMastery(t.level);
    taught += target;
    held += Math.min(target, masteryOf(mastery, t.skillId));
  }
  return taught > 0 ? held / taught : 1;
}

function advance(
  state: BeamState,
  resource: Resource,
  gap: Gap,
  graph: SkillGraph,
  goalSkills: SkillRef[],
  utility: number,
  scores?: Map<string, ScoreBreakdown>,
): BeamState {
  const nextMastery = applyCompletion(state.mastery, resource);
  const milestoneLabel = milestoneFor(
    state.mastery,
    nextMastery,
    goalSkills,
    graph,
  );

  const item: PlannedItem = {
    resource,
    milestoneLabel,
    reasons: buildReasons(
      resource,
      gap,
      state,
      nextMastery,
      graph,
      milestoneLabel,
      scores,
    ),
  };

  return {
    items: [...state.items, item],
    mastery: nextMastery,
    hours: state.hours + resource.estHours,
    score: state.score + utility,
    used: new Set(state.used).add(resource.id),
  };
}

/**
 * The facts behind a recommendation. The explanation model may only rephrase
 * this object, which is what makes explanations impossible to hallucinate.
 */
function buildReasons(
  resource: Resource,
  gap: Gap,
  state: BeamState,
  nextMastery: MasteryVector,
  graph: SkillGraph,
  milestoneLabel: string | null,
  scores?: Map<string, ScoreBreakdown>,
): Reasons {
  const byId = new Map(gap.map((g) => [g.skillId, g]));

  const coversGapSkills = resource.teaches
    .filter((t) => byId.has(t.skillId))
    .map((t) => ({
      skillId: t.skillId,
      name: graph.name(t.skillId),
      fromLevel: round(masteryToLevel(masteryOf(state.mastery, t.skillId))),
      toLevel: round(masteryToLevel(masteryOf(nextMastery, t.skillId))),
    }))
    .filter((c) => c.toLevel > c.fromLevel);

  // Which earlier steps made this one possible.
  const unlockedBy: Reasons["unlockedBy"] = [];
  for (const req of resource.requires) {
    const provider = [...state.items]
      .reverse()
      .find((item) =>
        item.resource.teaches.some((t) => t.skillId === req.skillId),
      );
    if (provider) {
      unlockedBy.push({
        resourceId: provider.resource.id,
        title: provider.resource.title,
        skillId: req.skillId,
      });
    }
  }

  // Which skills this step opens up next.
  const unlocks = resource.teaches
    .flatMap((t) => graph.directDependents(t.skillId))
    .filter((dep, i, arr) => arr.indexOf(dep) === i)
    .filter((dep) => masteryOf(nextMastery, dep) < 1)
    .slice(0, 4)
    .map((skillId) => ({ skillId, name: graph.name(skillId) }));

  const learnerLevel = resource.teaches.length
    ? resource.teaches.reduce(
        (a, t) => a + masteryToLevel(masteryOf(state.mastery, t.skillId)),
        0,
      ) / resource.teaches.length
    : 0;
  const delta = resource.difficulty - (learnerLevel + 1);

  return {
    coversGapSkills,
    unlockedBy,
    unlocks,
    difficultyFit: {
      resourceDifficulty: resource.difficulty,
      learnerLevel: round(learnerLevel),
      verdict: delta < -1 ? "easy" : delta > 1 ? "stretch" : "aligned",
    },
    estHours: resource.estHours,
    milestoneContribution: milestoneLabel,
    scoreBreakdown: scores?.get(resource.id) ?? {
      tag: 0,
      dense: 0,
      lexical: 0,
      qualityPrior: 1,
      total: 0,
    },
  };
}

/** A milestone is a goal sub-skill crossing its target level. */
function milestoneFor(
  before: MasteryVector,
  after: MasteryVector,
  goalSkills: SkillRef[],
  graph: SkillGraph,
): string | null {
  for (const goal of goalSkills) {
    const target = levelToMastery(goal.level);
    if (
      masteryOf(before, goal.skillId) < target &&
      masteryOf(after, goal.skillId) >= target
    ) {
      return `Milestone: ${graph.name(goal.skillId)}`;
    }
  }
  return null;
}

function pickBest(
  beam: BeamState[],
  goalSkills: SkillRef[],
  graph: SkillGraph,
): BeamState {
  return [...beam].sort((a, b) => {
    const ga = gapMagnitude(computeGap(goalSkills, a.mastery, graph));
    const gb = gapMagnitude(computeGap(goalSkills, b.mastery, graph));
    if (Math.abs(ga - gb) > 1e-9) return ga - gb; // closer to the goal wins
    return a.hours - b.hours; // then cheaper wins
  })[0];
}

/**
 * Audit a produced path for prerequisite violations. Ours should always return
 * an empty array; the baseline's will not, and that difference is the headline
 * number in the evaluation.
 */
export function findPrereqViolations(
  items: Array<{ resource: Resource }>,
  startMastery: MasteryVector,
): Array<{ position: number; resourceId: string; missing: SkillRef[] }> {
  const violations: Array<{
    position: number;
    resourceId: string;
    missing: SkillRef[];
  }> = [];
  let mastery = { ...startMastery };

  items.forEach((item, index) => {
    const missing = item.resource.requires.filter(
      (req) => !meets(mastery, req),
    );
    if (missing.length > 0) {
      violations.push({
        position: index,
        resourceId: item.resource.id,
        missing,
      });
    }
    mastery = applyCompletion(mastery, item.resource);
  });

  return violations;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
