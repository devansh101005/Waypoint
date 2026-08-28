import { describe, expect, it } from "vitest";
import {
  computeGap,
  frontier,
  gapCard,
  gapMagnitude,
  PREREQ_WORKING_LEVEL,
} from "./gap";
import { buildGraph } from "./graph";
import {
  applyCompletion,
  applyStruggle,
  buildMastery,
  levelToMastery,
  propagateDownward,
} from "./mastery";
import type { Resource, SkillNode } from "./types";

/**
 * a → b → c is a chain (c requires b requires a); d is independent.
 */
const SKILLS: SkillNode[] = [
  { id: "a", name: "A", domain: "d", description: "", prereqs: [] },
  { id: "b", name: "B", domain: "d", description: "", prereqs: ["a"] },
  { id: "c", name: "C", domain: "d", description: "", prereqs: ["b"] },
  { id: "d", name: "D", domain: "d", description: "", prereqs: [] },
];

const graph = buildGraph(SKILLS);

function resource(over: Partial<Resource> & Pick<Resource, "id">): Resource {
  return {
    title: over.id,
    url: `https://x.dev/${over.id}`,
    provider: "P",
    type: "course",
    description: "",
    difficulty: 2,
    estHours: 5,
    quality: 4,
    teaches: [],
    requires: [],
    ...over,
  };
}

describe("SkillGraph", () => {
  it("collects transitive ancestors", () => {
    expect([...graph.ancestors("c")].sort()).toEqual(["a", "b"]);
    expect([...graph.ancestors("a")]).toEqual([]);
  });

  it("measures depth along the prerequisite chain", () => {
    expect(graph.depthTo("c", "b")).toBe(1);
    expect(graph.depthTo("c", "a")).toBe(2);
    expect(graph.depthTo("c", "d")).toBe(Infinity);
  });

  it("orders prerequisites before dependents", () => {
    const order = graph.topoOrder();
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("c"));
  });

  it("throws rather than emit an unlearnable order for a cyclic graph", () => {
    const cyclic = buildGraph([
      { id: "x", name: "X", domain: "d", description: "", prereqs: ["y"] },
      { id: "y", name: "Y", domain: "d", description: "", prereqs: ["x"] },
    ]);
    expect(() => cyclic.topoOrder()).toThrow(/cycle/i);
  });

  it("ignores prerequisites pointing at skills outside the graph", () => {
    const partial = buildGraph([
      { id: "x", name: "X", domain: "d", description: "", prereqs: ["ghost"] },
    ]);
    expect(partial.directPrereqs("x")).toEqual([]);
    expect(() => partial.topoOrder()).not.toThrow();
  });
});

describe("computeGap", () => {
  it("pulls in unmastered prerequisites of the goal", () => {
    const gap = computeGap([{ skillId: "c", level: 4 }], {}, graph);
    expect(gap.map((g) => g.skillId).sort()).toEqual(["a", "b", "c"]);
  });

  it("marks only requested skills as goals and decays prerequisite weight with depth", () => {
    const gap = computeGap([{ skillId: "c", level: 4 }], {}, graph);
    const byId = Object.fromEntries(gap.map((g) => [g.skillId, g]));
    expect(byId.c.isGoal).toBe(true);
    expect(byId.b.isGoal).toBe(false);
    expect(byId.b.weight).toBeGreaterThan(byId.a.weight);
  });

  it("caps prerequisite targets at working competence", () => {
    const gap = computeGap([{ skillId: "c", level: 5 }], {}, graph);
    const b = gap.find((g) => g.skillId === "b")!;
    expect(b.target).toBeCloseTo(levelToMastery(PREREQ_WORKING_LEVEL));
  });

  it("excludes skills the learner has already mastered", () => {
    const mastery = { a: 1, b: 1 };
    const gap = computeGap([{ skillId: "c", level: 4 }], mastery, graph);
    expect(gap.map((g) => g.skillId)).toEqual(["c"]);
  });

  it("returns an empty gap when the learner already exceeds the goal", () => {
    const mastery = { a: 1, b: 1, c: 1 };
    const gap = computeGap([{ skillId: "c", level: 3 }], mastery, graph);
    expect(gap).toEqual([]);
    expect(gapMagnitude(gap)).toBe(0);
  });

  it("keeps the higher target when goals overlap", () => {
    const gap = computeGap(
      [
        { skillId: "b", level: 2 },
        { skillId: "b", level: 5 },
      ],
      {},
      graph,
    );
    expect(gap.find((g) => g.skillId === "b")!.target).toBeCloseTo(
      levelToMastery(5),
    );
  });

  it("ignores goal skills that are not in the graph", () => {
    const gap = computeGap([{ skillId: "ghost", level: 3 }], {}, graph);
    expect(gap).toEqual([]);
  });

  it("shrinks as the learner progresses", () => {
    const before = computeGap([{ skillId: "c", level: 4 }], {}, graph);
    const after = computeGap([{ skillId: "c", level: 4 }], { a: 1 }, graph);
    expect(gapMagnitude(after)).toBeLessThan(gapMagnitude(before));
  });
});

describe("frontier", () => {
  it("offers only skills whose prerequisites are already held", () => {
    const gap = computeGap([{ skillId: "c", level: 4 }], {}, graph);
    expect(frontier(gap, {}, graph).map((g) => g.skillId)).toEqual(["a"]);
  });

  it("expands as prerequisites are satisfied", () => {
    const mastery = { a: 1 };
    const gap = computeGap([{ skillId: "c", level: 4 }], mastery, graph);
    expect(frontier(gap, mastery, graph).map((g) => g.skillId)).toEqual(["b"]);
  });

  it("never returns empty while a gap remains", () => {
    const gap = computeGap([{ skillId: "c", level: 4 }], {}, graph);
    expect(frontier(gap, {}, graph).length).toBeGreaterThan(0);
  });
});

describe("mastery", () => {
  it("takes stated skills at face value", () => {
    expect(
      buildMastery({ stated: [{ skillId: "a", level: 5 }] }).a,
    ).toBeCloseTo(1);
  });

  it("credits a completed course with exactly the level it teaches", () => {
    // Quality must not discount the gain, or a level-N target becomes
    // unreachable from a level-N course and no path can ever complete.
    const good = buildMastery({
      completed: [
        resource({
          id: "R1",
          teaches: [{ skillId: "a", level: 5 }],
          quality: 5,
        }),
      ],
    });
    const weak = buildMastery({
      completed: [
        resource({
          id: "R2",
          teaches: [{ skillId: "a", level: 5 }],
          quality: 1,
        }),
      ],
    });
    expect(good.a).toBeCloseTo(1);
    expect(weak.a).toBeCloseTo(1);
  });

  it("never lowers mastery on completion", () => {
    const start = { a: 0.9 };
    const after = applyCompletion(
      start,
      resource({ id: "R", teaches: [{ skillId: "a", level: 1 }] }),
    );
    expect(after.a).toBeCloseTo(0.9);
  });

  it("knocks down prerequisites when the learner struggles", () => {
    const start = { a: 1, b: 0.8 };
    const after = applyStruggle(
      start,
      resource({ id: "R", requires: [{ skillId: "a", level: 3 }] }),
    );
    expect(after.a).toBeLessThan(1);
    expect(after.b).toBeCloseTo(0.8); // untouched
  });

  it("propagates evidence down to unstated prerequisites only as a floor", () => {
    const propagated = propagateDownward({ c: 1, a: 0.9 }, graph);
    expect(propagated.b).toBeCloseTo(0.5);
    expect(propagated.a).toBeCloseTo(0.9); // measured value is not lowered
  });
});

describe("gapCard", () => {
  it("describes the need in skill names, not the raw query", () => {
    const gap = computeGap([{ skillId: "c", level: 4 }], { a: 0.6 }, graph);
    const card = gapCard(gap, graph, {
      goalText: "I want to build things",
      hoursPerWeek: 6,
    });
    expect(card).toContain("Needs to learn");
    expect(card).toContain("C");
    expect(card).toContain("6 hours per week");
  });
});
