import { describe, expect, it, vi } from "vitest";
import {
  explainPath,
  explainStep,
  renderTemplate,
  validate,
  type ExplainInput,
} from "./explain";
import { buildGraph } from "./graph";
import {
  extractIntake,
  mergeIntake,
  normalise,
  type RawIntake,
} from "./intake";
import type { Reasons, SkillNode } from "./types";

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
const SKILL_NAMES = SKILLS.map((s) => s.name);

function reasons(over: Partial<Reasons> = {}): Reasons {
  return {
    coversGapSkills: [
      { skillId: "sql-joins", name: "SQL Joins", fromLevel: 0, toLevel: 3 },
    ],
    unlockedBy: [
      { resourceId: "RES-008", title: "SQLBolt", skillId: "sql-basics" },
    ],
    unlocks: [{ skillId: "dashboarding", name: "Dashboarding" }],
    difficultyFit: {
      resourceDifficulty: 2,
      learnerLevel: 1,
      verdict: "aligned",
    },
    estHours: 12,
    milestoneContribution: null,
    scoreBreakdown: {
      tag: 0.8,
      dense: 0,
      lexical: 0,
      qualityPrior: 1,
      total: 0.8,
    },
    ...over,
  };
}

const step: ExplainInput = {
  title: "SQL for Data Analysis",
  position: 2,
  reasons: reasons(),
};

describe("renderTemplate", () => {
  it("states the level movement, the ordering reason and the hours", () => {
    const text = renderTemplate(step);
    expect(text).toContain("SQL Joins");
    expect(text).toContain("SQLBolt");
    expect(text).toContain("12 hours");
  });

  it("names what the step unlocks", () => {
    expect(renderTemplate(step)).toContain("Dashboarding");
  });

  it("handles a first step with nothing before it", () => {
    const first = { ...step, reasons: reasons({ unlockedBy: [] }) };
    const text = renderTemplate(first);
    expect(text).not.toContain("comes after");
    expect(text.length).toBeGreaterThan(20);
  });

  it("calls out a stretch step", () => {
    const hard = {
      ...step,
      reasons: reasons({
        difficultyFit: {
          resourceDifficulty: 5,
          learnerLevel: 1,
          verdict: "stretch",
        },
      }),
    };
    expect(renderTemplate(hard)).toContain("stretch");
  });

  it("mentions a milestone when the step completes one", () => {
    const milestone = {
      ...step,
      reasons: reasons({ milestoneContribution: "Milestone: Dashboarding" }),
    };
    const text = renderTemplate(milestone);
    expect(text).toContain("milestone");
    expect(text).not.toContain("Milestone: Milestone");
  });

  it("lists several covered skills readably", () => {
    const many = {
      ...step,
      reasons: reasons({
        coversGapSkills: [
          {
            skillId: "sql-basics",
            name: "SQL Basics",
            fromLevel: 0,
            toLevel: 4,
          },
          { skillId: "sql-joins", name: "SQL Joins", fromLevel: 0, toLevel: 3 },
        ],
      }),
    };
    expect(renderTemplate(many)).toContain("SQL Basics and SQL Joins");
  });

  it("still says something useful when a step covers nothing new", () => {
    const empty = { ...step, reasons: reasons({ coversGapSkills: [] }) };
    expect(renderTemplate(empty).length).toBeGreaterThan(20);
  });

  it("phrases a single hour correctly", () => {
    const short = { ...step, reasons: reasons({ estHours: 1 }) };
    expect(renderTemplate(short)).toContain("an hour");
  });
});

describe("validate — hallucination guard", () => {
  it("accepts prose that stays within the step's facts", () => {
    const text =
      "This takes your SQL Joins from level 0 to 3, building on SQLBolt. It opens up Dashboarding next.";
    expect(validate(text, step, SKILL_NAMES)).toBeNull();
  });

  it("rejects prose naming a skill the step has nothing to do with", () => {
    const text =
      "This takes your SQL Joins to level 3 and also strengthens your React Hooks along the way.";
    expect(validate(text, step, SKILL_NAMES)).toContain("React Hooks");
  });

  it("does not fire on a skill name embedded in a larger word", () => {
    const text =
      "This takes your SQL Joins from 0 to 3, which adjoins the reporting work you do.";
    expect(validate(text, step, SKILL_NAMES)).toBeNull();
  });

  it("allows the skill that links this step to the one before it", () => {
    // Regression: the guard used to reject a correct explanation of ordering
    // because the linking skill was not in its permitted set.
    const text =
      "This takes your SQL Joins to level 3. It follows SQLBolt because it assumes the SQL Basics that teaches.";
    expect(validate(text, step, SKILL_NAMES, { "sql-basics": "SQL Basics" })).toBeNull();
  });

  it("still rejects a skill unrelated to the step even with the map supplied", () => {
    const text = "This takes your SQL Joins to level 3 and also builds React Hooks.";
    expect(validate(text, step, SKILL_NAMES, { "sql-basics": "SQL Basics" })).toContain(
      "React Hooks",
    );
  });

  it("rejects an empty or truncated reply", () => {
    expect(validate("Sure!", step, SKILL_NAMES)).toBe("reply too short");
  });

  it("rejects a runaway reply", () => {
    expect(validate("word ".repeat(400), step, SKILL_NAMES)).toBe(
      "reply too long",
    );
  });
});

describe("explainStep", () => {
  it("uses the model's phrasing when it stays grounded", async () => {
    const completion = vi
      .fn()
      .mockResolvedValue(
        "You will move SQL Joins from level 0 to 3 here, which follows on from SQLBolt.",
      );
    const result = await explainStep(step, {
      completion,
      knownSkillNames: SKILL_NAMES,
    });
    expect(result.source).toBe("model");
    expect(completion).toHaveBeenCalledOnce();
  });

  it("falls back to the template when the model invents a skill", async () => {
    const completion = vi
      .fn()
      .mockResolvedValue(
        "This will also sharpen your React Hooks, which employers love.",
      );
    const result = await explainStep(step, {
      completion,
      knownSkillNames: SKILL_NAMES,
    });
    expect(result.source).toBe("template");
    expect(result.rejectedBecause).toContain("React Hooks");
    expect(result.text).toContain("SQL Joins");
  });

  it("falls back to the template when the model call fails", async () => {
    const completion = vi.fn().mockRejectedValue(new Error("gateway down"));
    const result = await explainStep(step, {
      completion,
      knownSkillNames: SKILL_NAMES,
    });
    expect(result.source).toBe("template");
    expect(result.rejectedBecause).toBe("model call failed");
    expect(result.text.length).toBeGreaterThan(20);
  });

  it("never sends the catalogue to the model, only this step's facts", async () => {
    const completion = vi
      .fn()
      .mockResolvedValue("You will move SQL Joins from level 0 to 3 here.");
    await explainStep(step, { completion, knownSkillNames: SKILL_NAMES });
    const sent = JSON.stringify(completion.mock.calls[0][0]);
    expect(sent).not.toContain("react-hooks");
    expect(sent).toContain("SQL Joins");
  });

  it("explains a whole path", async () => {
    const completion = vi
      .fn()
      .mockResolvedValue("You will move SQL Joins from level 0 to 3 here.");
    const out = await explainPath([step, { ...step, position: 3 }], {
      completion,
      knownSkillNames: SKILL_NAMES,
    });
    expect(out).toHaveLength(2);
    expect(completion).toHaveBeenCalledTimes(2);
  });
});

describe("intake extraction", () => {
  function raw(over: Partial<RawIntake> = {}): RawIntake {
    return {
      goalSkills: [{ skill: "dashboarding", level: 4 }],
      statedSkills: [],
      constraints: {},
      goalSummary: "You want to build dashboards.",
      followUpQuestion: null,
      ...over,
    };
  }

  it("keeps skills that exist in the graph", async () => {
    const result = await extractIntake(
      [{ role: "user", content: "dashboards please" }],
      graph,
      {
        extractor: async () => raw(),
      },
    );
    expect(result.goalSkills).toEqual([{ skillId: "dashboarding", level: 4 }]);
    expect(result.ready).toBe(true);
  });

  it("drops invented slugs instead of passing them to the planner", async () => {
    const result = await extractIntake(
      [{ role: "user", content: "x" }],
      graph,
      {
        extractor: async () =>
          raw({
            goalSkills: [
              { skill: "dashboarding", level: 4 },
              { skill: "quantum-blockchain", level: 5 },
            ],
          }),
      },
    );
    expect(result.goalSkills.map((g) => g.skillId)).toEqual(["dashboarding"]);
    expect(result.droppedSkills).toEqual(["quantum-blockchain"]);
  });

  it("is not ready when no goal skill could be resolved", async () => {
    const result = await extractIntake(
      [{ role: "user", content: "hi" }],
      graph,
      {
        extractor: async () =>
          raw({
            goalSkills: [],
            followUpQuestion: "What do you want to build?",
          }),
      },
    );
    expect(result.ready).toBe(false);
    expect(result.followUpQuestion).toBe("What do you want to build?");
  });

  it("clamps out-of-range levels rather than rejecting the whole extraction", () => {
    const result = normalise(
      { ...raw({ goalSkills: [{ skill: "dashboarding", level: 9 }] }) },
      graph,
    );
    expect(result.goalSkills[0].level).toBe(5);
  });

  it("keeps the highest level when a skill appears twice", () => {
    const result = normalise(
      raw({
        goalSkills: [
          { skill: "dashboarding", level: 2 },
          { skill: "dashboarding", level: 5 },
        ],
      }),
      graph,
    );
    expect(result.goalSkills).toEqual([{ skillId: "dashboarding", level: 5 }]);
  });

  it("carries through constraints the learner stated", () => {
    const result = normalise(
      raw({ constraints: { hoursPerWeek: 6, formats: ["video"] } }),
      graph,
    );
    expect(result.constraints.hoursPerWeek).toBe(6);
    expect(result.constraints.formats).toEqual(["video"]);
  });

  it("includes only catalogue slugs in the prompt it sends", async () => {
    let sent = "";
    await extractIntake([{ role: "user", content: "x" }], graph, {
      extractor: async (messages) => {
        sent = messages[0].content;
        return raw();
      },
    });
    expect(sent).toContain("dashboarding");
    expect(sent).toContain("react-hooks");
  });
});

describe("mergeIntake", () => {
  const first = normalise(
    {
      goalSkills: [{ skill: "dashboarding", level: 4 }],
      statedSkills: [{ skill: "sql-basics", level: 2 }],
      constraints: { hoursPerWeek: 5 },
      goalSummary: "Dashboards.",
      followUpQuestion: null,
    },
    graph,
  );

  it("returns the new profile when there is no previous one", () => {
    expect(mergeIntake(null, first)).toBe(first);
  });

  it("keeps the earlier goal when a later turn adds only skills", () => {
    const later = normalise(
      {
        goalSkills: [],
        statedSkills: [{ skill: "sql-joins", level: 3 }],
        constraints: {},
        goalSummary: "",
        followUpQuestion: null,
      },
      graph,
    );
    const merged = mergeIntake(first, later);
    expect(merged.goalSkills.map((g) => g.skillId)).toEqual(["dashboarding"]);
    expect(merged.statedSkills.map((s) => s.skillId).sort()).toEqual([
      "sql-basics",
      "sql-joins",
    ]);
    expect(merged.goalSummary).toBe("Dashboards.");
  });

  it("takes the higher level when the learner revises a claim upward", () => {
    const later = normalise(
      {
        goalSkills: [],
        statedSkills: [{ skill: "sql-basics", level: 5 }],
        constraints: {},
        goalSummary: "",
        followUpQuestion: null,
      },
      graph,
    );
    expect(mergeIntake(first, later).statedSkills[0].level).toBe(5);
  });

  it("lets later constraints override earlier ones", () => {
    const later = normalise(
      {
        goalSkills: [],
        statedSkills: [],
        constraints: { hoursPerWeek: 20 },
        goalSummary: "",
        followUpQuestion: null,
      },
      graph,
    );
    expect(mergeIntake(first, later).constraints.hoursPerWeek).toBe(20);
  });
});
