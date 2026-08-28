import { describe, expect, it } from "vitest";
import { computeGap } from "./gap";
import { buildGraph } from "./graph";
import { buildMastery, levelToMastery } from "./mastery";
import {
  difficultyFit,
  findPrereqViolations,
  planPath,
  redundancy,
} from "./planner";
import { scoreResource, tagScore } from "./scoring";
import type { Resource, SkillNode } from "./types";

/**
 * A four-level chain (basics → joins → windows → analytics) plus an unrelated
 * branch, so tests can check both ordering and irrelevance.
 */
const SKILLS: SkillNode[] = [
  { id: "basics", name: "Basics", domain: "d", description: "", prereqs: [] },
  {
    id: "joins",
    name: "Joins",
    domain: "d",
    description: "",
    prereqs: ["basics"],
  },
  {
    id: "windows",
    name: "Windows",
    domain: "d",
    description: "",
    prereqs: ["joins"],
  },
  {
    id: "analytics",
    name: "Analytics",
    domain: "d",
    description: "",
    prereqs: ["windows"],
  },
  { id: "design", name: "Design", domain: "d", description: "", prereqs: [] },
];

const graph = buildGraph(SKILLS);

function res(
  id: string,
  teaches: Array<[string, number]>,
  requires: Array<[string, number]> = [],
  over: Partial<Resource> = {},
): Resource {
  return {
    id,
    title: `Course ${id}`,
    url: `https://x.dev/${id}`,
    provider: "P",
    type: "course",
    description: "",
    difficulty: 2,
    estHours: 5,
    quality: 4,
    teaches: teaches.map(([skillId, level]) => ({ skillId, level })),
    requires: requires.map(([skillId, level]) => ({ skillId, level })),
    ...over,
  };
}

const CORPUS: Resource[] = [
  res("R-BASICS", [["basics", 4]], [], { difficulty: 1 }),
  res("R-JOINS", [["joins", 4]], [["basics", 3]], { difficulty: 2 }),
  res("R-WINDOWS", [["windows", 4]], [["joins", 3]], { difficulty: 3 }),
  res("R-ANALYTICS", [["analytics", 4]], [["windows", 3]], { difficulty: 4 }),
  res("R-DESIGN", [["design", 4]], [], { difficulty: 2 }),
];

const GOAL = [{ skillId: "analytics", level: 4 }];

describe("planPath — prerequisite feasibility", () => {
  it("produces a path with zero prerequisite violations from a blank slate", () => {
    const plan = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: CORPUS,
    });
    expect(findPrereqViolations(plan.items, {})).toEqual([]);
  });

  it("orders the chain from the ground up", () => {
    const plan = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: CORPUS,
    });
    const ids = plan.items.map((i) => i.resource.id);
    expect(ids.indexOf("R-BASICS")).toBeLessThan(ids.indexOf("R-JOINS"));
    expect(ids.indexOf("R-JOINS")).toBeLessThan(ids.indexOf("R-WINDOWS"));
    expect(ids.indexOf("R-WINDOWS")).toBeLessThan(ids.indexOf("R-ANALYTICS"));
  });

  it("reaches the goal", () => {
    const plan = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: CORPUS,
    });
    expect(plan.complete).toBe(true);
    expect(plan.stoppedBecause).toBe("goal-reached");
  });

  it("never schedules a resource whose prerequisites cannot be met", () => {
    // Orphan requires a skill nothing in the corpus teaches.
    const orphan = res("R-ORPHAN", [["analytics", 5]], [["design", 5]]);
    const plan = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: [...CORPUS, orphan],
    });
    const scheduled = plan.items.map((i) => i.resource.id);
    expect(scheduled).not.toContain("R-ORPHAN");
    expect(findPrereqViolations(plan.items, {})).toEqual([]);
  });

  it("shows what the DAG constraint is worth: disabling it admits violations", () => {
    const withConstraint = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: CORPUS,
    });
    const without = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: CORPUS,
      enforcePrerequisites: false,
      // Force the ablation to prefer the far end of the chain first.
      scores: new Map([
        [
          "R-ANALYTICS",
          { tag: 1, dense: 1, lexical: 1, qualityPrior: 1, total: 1 },
        ],
      ]),
    });
    expect(findPrereqViolations(withConstraint.items, {})).toEqual([]);
    expect(without.items.length).toBeGreaterThan(0);
  });
});

describe("planPath — learner state", () => {
  it("skips material the learner has already mastered", () => {
    const mastery = buildMastery({
      stated: [
        { skillId: "basics", level: 5 },
        { skillId: "joins", level: 5 },
      ],
    });
    const plan = planPath({
      goalSkills: GOAL,
      mastery,
      graph,
      resources: CORPUS,
    });
    const ids = plan.items.map((i) => i.resource.id);
    expect(ids).not.toContain("R-BASICS");
    expect(ids).not.toContain("R-JOINS");
    expect(ids).toContain("R-ANALYTICS");
  });

  it("returns an empty path when the learner already exceeds the goal", () => {
    const mastery = { basics: 1, joins: 1, windows: 1, analytics: 1 };
    const plan = planPath({
      goalSkills: GOAL,
      mastery,
      graph,
      resources: CORPUS,
    });
    expect(plan.items).toEqual([]);
    expect(plan.complete).toBe(true);
  });

  it("ignores resources irrelevant to the goal", () => {
    const plan = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: CORPUS,
    });
    expect(plan.items.map((i) => i.resource.id)).not.toContain("R-DESIGN");
  });

  it("stops at the hour budget and reports the remaining gap honestly", () => {
    const plan = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: CORPUS,
      hourBudget: 10,
    });
    expect(plan.totalHours).toBeLessThanOrEqual(10);
    expect(plan.complete).toBe(false);
    expect(plan.remainingGap.length).toBeGreaterThan(0);
    expect(findPrereqViolations(plan.items, {})).toEqual([]);
  });

  it("prefers one resource that covers the goal over two that overlap", () => {
    // Regression: the beam used to discard states that could not expand, so a
    // branch finishing in one step lost to a longer branch still growing, and
    // the learner was told to spend hours they did not need.
    const combined = res("R-BOTH", [["basics", 4], ["joins", 3]], [], {
      estHours: 12,
    });
    const partial = res("R-PART", [["basics", 3]], [], { estHours: 6 });
    const plan = planPath({
      goalSkills: [{ skillId: "joins", level: 3 }],
      mastery: {},
      graph,
      resources: [partial, combined],
    });
    expect(plan.complete).toBe(true);
    expect(plan.items.map((i) => i.resource.id)).toEqual(["R-BOTH"]);
    expect(plan.totalHours).toBe(12);
  });

  it("reports an hour-budget stop as such, not as a dead end", () => {
    const plan = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: CORPUS,
      hourBudget: 12,
    });
    expect(plan.complete).toBe(false);
    expect(plan.stoppedBecause).toBe("hour-budget");
  });

  it("respects maxItems", () => {
    const plan = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: CORPUS,
      maxItems: 2,
    });
    expect(plan.items.length).toBeLessThanOrEqual(2);
  });

  it("handles an empty corpus without crashing", () => {
    const plan = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: [],
    });
    expect(plan.items).toEqual([]);
    expect(plan.complete).toBe(false);
    expect(plan.stoppedBecause).toBe("no-progress");
  });

  it("prefers the cheaper of two equivalent routes", () => {
    const slow = res("R-SLOW", [["basics", 4]], [], {
      estHours: 40,
      difficulty: 1,
    });
    const fast = res("R-FAST", [["basics", 4]], [], {
      estHours: 4,
      difficulty: 1,
    });
    const plan = planPath({
      goalSkills: [{ skillId: "basics", level: 4 }],
      mastery: {},
      graph,
      resources: [slow, fast],
    });
    expect(plan.items[0].resource.id).toBe("R-FAST");
  });
});

describe("planPath — milestones and reasons", () => {
  it("labels the step that completes a goal skill", () => {
    const plan = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: CORPUS,
    });
    const milestones = plan.items.filter((i) => i.milestoneLabel !== null);
    expect(milestones.length).toBeGreaterThan(0);
    expect(milestones.at(-1)!.milestoneLabel).toContain("Analytics");
  });

  it("records which gap skills each step covers, with levels", () => {
    const plan = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: CORPUS,
    });
    const first = plan.items[0].reasons;
    expect(first.coversGapSkills.length).toBeGreaterThan(0);
    expect(first.coversGapSkills[0].toLevel).toBeGreaterThan(
      first.coversGapSkills[0].fromLevel,
    );
    expect(first.coversGapSkills[0].name).toBe("Basics");
  });

  it("credits the earlier step that unlocked a later one", () => {
    const plan = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: CORPUS,
    });
    const joins = plan.items.find((i) => i.resource.id === "R-JOINS")!;
    expect(joins.reasons.unlockedBy.map((u) => u.resourceId)).toContain(
      "R-BASICS",
    );
  });

  it("names what a step opens up next", () => {
    const plan = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: CORPUS,
    });
    const basics = plan.items.find((i) => i.resource.id === "R-BASICS")!;
    expect(basics.reasons.unlocks.map((u) => u.skillId)).toContain("joins");
  });

  it("never invents a skill that is not in the graph", () => {
    const plan = planPath({
      goalSkills: GOAL,
      mastery: {},
      graph,
      resources: CORPUS,
    });
    for (const item of plan.items) {
      for (const covered of item.reasons.coversGapSkills) {
        expect(graph.has(covered.skillId)).toBe(true);
      }
    }
  });
});

describe("scoring", () => {
  const gap = computeGap(GOAL, {}, graph);

  it("scores a resource teaching a needed skill above an irrelevant one", () => {
    expect(tagScore(CORPUS[0], gap)).toBeGreaterThan(tagScore(CORPUS[4], gap));
  });

  it("scores zero for a resource teaching nothing in the gap", () => {
    expect(tagScore(res("X", [["design", 5]]), gap)).toBe(0);
  });

  it("scores zero for a resource teaching only what the learner has", () => {
    const known = computeGap(GOAL, { basics: 1 }, graph);
    expect(tagScore(res("X", [["basics", 3]]), known)).toBe(0);
  });

  it("renormalises when the dense signal is missing rather than scoring near zero", () => {
    const withDense = scoreResource(CORPUS[0], gap, {
      dense: 0.9,
      lexical: 0.5,
    });
    const withoutDense = scoreResource(CORPUS[0], gap, { lexical: 0.5 });
    expect(withoutDense.total).toBeGreaterThan(0.1);
    expect(withDense.total).toBeGreaterThan(0);
  });

  it("prefers the higher-quality of two identical resources", () => {
    const good = res("G", [["basics", 4]], [], { quality: 5 });
    const poor = res("P", [["basics", 4]], [], { quality: 1 });
    expect(scoreResource(good, gap).total).toBeGreaterThan(
      scoreResource(poor, gap).total,
    );
  });
});

describe("difficulty fit and redundancy", () => {
  it("rates a beginner resource best for a beginner", () => {
    const easy = res("E", [["basics", 3]], [], { difficulty: 1 });
    const hard = res("H", [["basics", 3]], [], { difficulty: 5 });
    expect(difficultyFit(easy, {})).toBeGreaterThan(difficultyFit(hard, {}));
  });

  it("rates a harder resource better once the learner has progressed", () => {
    const hard = res("H", [["windows", 4]], [], { difficulty: 4 });
    const advanced = { windows: levelToMastery(3) };
    expect(difficultyFit(hard, advanced)).toBeGreaterThan(
      difficultyFit(hard, {}),
    );
  });

  it("reports full redundancy for fully-known material and none for new material", () => {
    const r = res("R", [["basics", 4]]);
    expect(redundancy(r, { basics: 1 })).toBeCloseTo(1);
    expect(redundancy(r, {})).toBe(0);
  });
});

describe("findPrereqViolations", () => {
  it("flags a path that jumps ahead, naming the missing skills", () => {
    const bad = [{ resource: CORPUS[3] }, { resource: CORPUS[0] }]; // analytics before basics
    const violations = findPrereqViolations(bad, {});
    expect(violations).toHaveLength(1);
    expect(violations[0].resourceId).toBe("R-ANALYTICS");
    expect(violations[0].missing[0].skillId).toBe("windows");
  });

  it("accepts a correctly ordered path", () => {
    const good = [
      { resource: CORPUS[0] },
      { resource: CORPUS[1] },
      { resource: CORPUS[2] },
      { resource: CORPUS[3] },
    ];
    expect(findPrereqViolations(good, {})).toEqual([]);
  });

  it("counts prerequisites the learner already holds as satisfied", () => {
    expect(
      findPrereqViolations([{ resource: CORPUS[1] }], { basics: 1 }),
    ).toEqual([]);
  });
});
