import { describe, expect, it } from "vitest";
import { baselinePath, lexicalSimilarities } from "./baseline";
import {
  evaluatePath,
  gapCoverage,
  kendallTau,
  macroAverage,
  ndcg,
  pathRedundancy,
  prereqViolationRate,
} from "./eval";
import { buildGraph } from "./graph";
import type { Resource, SkillNode } from "./types";

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

const A = res("A", [["basics", 4]]);
const B = res("B", [["joins", 4]], [["basics", 3]]);
const C = res("C", [["windows", 4]], [["joins", 3]]);

describe("prereqViolationRate", () => {
  it("is zero for a correctly ordered path", () => {
    expect(
      prereqViolationRate({ items: [{ resource: A }, { resource: B }] }, {}),
    ).toBe(0);
  });

  it("counts every step the learner was not ready for", () => {
    // C then B, from nothing: both jump ahead.
    expect(
      prereqViolationRate({ items: [{ resource: C }, { resource: B }] }, {}),
    ).toBe(1);
  });

  it("is zero for an empty path rather than undefined", () => {
    expect(prereqViolationRate({ items: [] }, {})).toBe(0);
  });
});

describe("gapCoverage", () => {
  const goal = [{ skillId: "windows", level: 4 }];

  it("is 1 when the path reaches the goal", () => {
    const path = { items: [{ resource: A }, { resource: B }, { resource: C }] };
    expect(gapCoverage(path, goal, {}, graph)).toBeCloseTo(1);
  });

  it("is 0 for a path that teaches nothing relevant", () => {
    const irrelevant = res("Z", [["basics", 0]]);
    expect(
      gapCoverage({ items: [{ resource: irrelevant }] }, goal, {}, graph),
    ).toBeCloseTo(0);
  });

  it("is partial for a path that stops short", () => {
    const coverage = gapCoverage({ items: [{ resource: A }] }, goal, {}, graph);
    expect(coverage).toBeGreaterThan(0);
    expect(coverage).toBeLessThan(1);
  });
});

describe("pathRedundancy", () => {
  it("is zero when nothing is repeated", () => {
    expect(
      pathRedundancy({ items: [{ resource: A }, { resource: B }] }, {}),
    ).toBe(0);
  });

  it("rises when the path reteaches what the learner already had", () => {
    expect(
      pathRedundancy({ items: [{ resource: A }] }, { basics: 1 }),
    ).toBeCloseTo(1);
  });

  it("counts a repeated resource within the path", () => {
    const twice = pathRedundancy(
      { items: [{ resource: A }, { resource: A }] },
      {},
    );
    expect(twice).toBeCloseTo(0.5);
  });
});

describe("ndcg", () => {
  it("is 1 for the expert ordering exactly", () => {
    expect(ndcg(["A", "B", "C"], ["A", "B", "C"])).toBeCloseTo(1);
  });

  it("is lower when the order is reversed", () => {
    expect(ndcg(["C", "B", "A"], ["A", "B", "C"])).toBeLessThan(1);
  });

  it("is 0 when nothing overlaps", () => {
    expect(ndcg(["X", "Y"], ["A", "B"])).toBe(0);
  });

  it("rewards putting expert items earlier", () => {
    const early = ndcg(["A", "X", "Y"], ["A", "B", "C"]);
    const late = ndcg(["X", "Y", "A"], ["A", "B", "C"]);
    expect(early).toBeGreaterThan(late);
  });

  it("returns 0 for an empty expert path instead of dividing by zero", () => {
    expect(ndcg(["A"], [])).toBe(0);
  });
});

describe("kendallTau", () => {
  it("is 1 for identical ordering of the overlap", () => {
    expect(kendallTau(["A", "B", "C"], ["A", "B", "C"])).toBe(1);
  });

  it("is -1 for exactly reversed ordering", () => {
    expect(kendallTau(["C", "B", "A"], ["A", "B", "C"])).toBe(-1);
  });

  it("ignores items the expert did not choose", () => {
    expect(kendallTau(["A", "X", "B"], ["A", "B"])).toBe(1);
  });

  it("returns null rather than a meaningless number when overlap is too small", () => {
    expect(kendallTau(["A"], ["A", "B"])).toBeNull();
    expect(kendallTau(["X"], ["A", "B"])).toBeNull();
  });
});

describe("evaluatePath", () => {
  it("scores a correct path better than a jumbled one on every sequence metric", () => {
    const goalSkills = [{ skillId: "windows", level: 4 }];
    const expert = ["A", "B", "C"];
    const good = evaluatePath(
      "ours",
      { items: [{ resource: A }, { resource: B }, { resource: C }] },
      { goalSkills, startMastery: {}, graph, expertPath: expert },
    );
    const bad = evaluatePath(
      "baseline",
      { items: [{ resource: C }, { resource: B }, { resource: A }] },
      { goalSkills, startMastery: {}, graph, expertPath: expert },
    );

    expect(good.prereqViolationRate).toBeLessThan(bad.prereqViolationRate);
    expect(good.ndcg).toBeGreaterThan(bad.ndcg);
    expect(good.kendallTau).toBeGreaterThan(bad.kendallTau);
    expect(good.gapCoverage).toBeCloseTo(bad.gapCoverage); // same items, same coverage
  });
});

describe("macroAverage", () => {
  it("averages each metric across scenarios", () => {
    const avg = macroAverage([
      {
        system: "ours",
        prereqViolationRate: 0,
        gapCoverage: 1,
        redundancy: 0,
        ndcg: 1,
        kendallTau: 1,
        totalHours: 10,
      },
      {
        system: "ours",
        prereqViolationRate: 0.5,
        gapCoverage: 0.5,
        redundancy: 0.2,
        ndcg: 0.5,
        kendallTau: 0,
        totalHours: 20,
      },
    ]);
    expect(avg.prereqViolationRate).toBeCloseTo(0.25);
    expect(avg.gapCoverage).toBeCloseTo(0.75);
    expect(avg.totalHours).toBeCloseTo(15);
  });
});

describe("baseline", () => {
  const corpus = [
    res("SQL", [["basics", 4]], [], {
      title: "SQL for Analysts",
      description: "Learn SQL queries and joins.",
    }),
    res("COOK", [["basics", 4]], [], {
      title: "Italian Cooking",
      description: "Pasta and sauces.",
    }),
  ];

  it("ranks a topically matching resource above an unrelated one", () => {
    const path = baselinePath(corpus, "I want to learn SQL for data analysis", {
      k: 2,
    });
    expect(path.items[0].resource.id).toBe("SQL");
  });

  it("respects k", () => {
    expect(baselinePath(corpus, "SQL", { k: 1 }).items).toHaveLength(1);
  });

  it("accepts supplied similarities so real embeddings can be used", () => {
    const path = baselinePath(corpus, "irrelevant text", {
      k: 2,
      similarity: new Map([
        ["COOK", 0.9],
        ["SQL", 0.1],
      ]),
    });
    expect(path.items[0].resource.id).toBe("COOK");
  });

  it("scores an unrelated query near zero", () => {
    const sims = lexicalSimilarities(corpus, "astrophysics telescope");
    expect(sims.get("SQL")).toBe(0);
  });

  it("is deterministic when scores tie", () => {
    const first = baselinePath(corpus, "zzz nothing matches", {
      k: 2,
    }).items.map((i) => i.resource.id);
    const second = baselinePath(corpus, "zzz nothing matches", {
      k: 2,
    }).items.map((i) => i.resource.id);
    expect(first).toEqual(second);
  });
});
