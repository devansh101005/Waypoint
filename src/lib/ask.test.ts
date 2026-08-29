import { describe, expect, it, vi } from "vitest";
import { askAboutPlan, describePlan, mentionsOnlyPlanContent } from "./ask";
import { buildGraph } from "./graph";
import type { StoredPath } from "./store";
import type { Reasons, Resource, SkillNode } from "./types";

const SKILLS: SkillNode[] = [
  {
    id: "sql-basics",
    name: "SQL Basics",
    domain: "d",
    description: "",
    prereqs: [],
  },
  {
    id: "sql-joins",
    name: "SQL Joins",
    domain: "d",
    description: "",
    prereqs: ["sql-basics"],
  },
  {
    id: "dashboarding",
    name: "Dashboarding",
    domain: "d",
    description: "",
    prereqs: ["sql-joins"],
  },
  {
    id: "react-hooks",
    name: "React Hooks",
    domain: "w",
    description: "",
    prereqs: [],
  },
];
const graph = buildGraph(SKILLS);

function resource(id: string, title: string): Resource {
  return {
    id,
    title,
    url: `https://x.dev/${id}`,
    provider: "Provider",
    type: "course",
    description: "",
    difficulty: 2,
    estHours: 10,
    quality: 4,
    teaches: [],
    requires: [],
  };
}

function reasons(over: Partial<Reasons> = {}): Reasons {
  return {
    coversGapSkills: [
      { skillId: "sql-basics", name: "SQL Basics", fromLevel: 0, toLevel: 4 },
    ],
    unlockedBy: [],
    unlocks: [{ skillId: "sql-joins", name: "SQL Joins" }],
    difficultyFit: {
      resourceDifficulty: 2,
      learnerLevel: 0,
      verdict: "aligned",
    },
    estHours: 10,
    milestoneContribution: null,
    scoreBreakdown: { tag: 1, dense: 0, lexical: 0, qualityPrior: 1, total: 1 },
    ...over,
  };
}

const PATH: StoredPath = {
  id: "p1",
  learnerId: "l1",
  goalSkills: [{ skillId: "dashboarding", level: 4 }],
  totalHours: 20,
  complete: true,
  supersedes: null,
  createdAt: "2026-08-29T00:00:00.000Z",
  items: [
    {
      resource: resource("RES-001", "SQL for Analysts"),
      reasons: reasons(),
      milestoneLabel: null,
    },
    {
      resource: resource("RES-002", "Dashboards in Practice"),
      reasons: reasons({
        coversGapSkills: [
          {
            skillId: "dashboarding",
            name: "Dashboarding",
            fromLevel: 0,
            toLevel: 4,
          },
        ],
        unlockedBy: [
          {
            resourceId: "RES-001",
            title: "SQL for Analysts",
            skillId: "sql-joins",
          },
        ],
        unlocks: [],
        milestoneContribution: "Milestone: Dashboarding",
      }),
      milestoneLabel: "Milestone: Dashboarding",
    },
  ],
};

describe("describePlan", () => {
  it("lists every step with hours and what it teaches", () => {
    const text = describePlan(PATH, graph);
    expect(text).toContain("Step 1: SQL for Analysts");
    expect(text).toContain("Step 2: Dashboards in Practice");
    expect(text).toContain("SQL Basics (level 0 to 4)");
    expect(text).toContain("10h");
  });

  it("records the dependency between steps so ordering can be explained", () => {
    expect(describePlan(PATH, graph)).toContain(
      "depends on earlier steps: SQL for Analysts",
    );
  });

  it("notes milestones and whether the plan reaches the goal", () => {
    const text = describePlan(PATH, graph);
    expect(text).toContain("Milestone: Dashboarding");
    expect(text).toContain("reaches the learner's goal");
  });

  it("describes a partial plan honestly", () => {
    const partial = { ...PATH, complete: false };
    expect(describePlan(partial, graph)).toContain("first phase");
  });
});

describe("mentionsOnlyPlanContent", () => {
  it("accepts an answer that stays within the plan", () => {
    const answer =
      "SQL for Analysts comes first because Dashboarding builds on SQL Joins.";
    expect(mentionsOnlyPlanContent(answer, PATH, graph)).toBe(true);
  });

  it("flags an answer that wanders into an unrelated skill", () => {
    const answer = "You should also pick up React Hooks while you are at it.";
    expect(mentionsOnlyPlanContent(answer, PATH, graph)).toBe(false);
  });

  it("does not flag a skill name appearing inside a longer word", () => {
    const answer = "The plan adjoins two topics that reinforce each other.";
    expect(mentionsOnlyPlanContent(answer, PATH, graph)).toBe(true);
  });
});

describe("askAboutPlan", () => {
  it("sends the plan and the question, and reports a grounded answer", async () => {
    const completion = vi
      .fn()
      .mockResolvedValue(
        "SQL for Analysts comes first because Dashboarding needs SQL Joins.",
      );
    const result = await askAboutPlan("Why is SQL first?", PATH, graph, {
      completion,
    });

    expect(result.grounded).toBe(true);
    const sent = JSON.stringify(completion.mock.calls[0][0]);
    expect(sent).toContain("Step 1: SQL for Analysts");
    expect(sent).toContain("Why is SQL first?");
  });

  it("reports an ungrounded answer rather than hiding it", async () => {
    const completion = vi
      .fn()
      .mockResolvedValue("Go and learn React Hooks first.");
    const result = await askAboutPlan("What next?", PATH, graph, {
      completion,
    });
    expect(result.grounded).toBe(false);
  });

  it("never puts the wider catalogue in the prompt", async () => {
    const completion = vi
      .fn()
      .mockResolvedValue("SQL for Analysts is step one.");
    await askAboutPlan("What is step one?", PATH, graph, { completion });
    const sent = JSON.stringify(completion.mock.calls[0][0]);
    expect(sent).not.toContain("React Hooks");
  });
});
