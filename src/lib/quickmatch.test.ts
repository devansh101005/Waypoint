import { describe, expect, it } from "vitest";
import { quickMatch } from "./quickmatch";
import type { SkillNode } from "./types";

const SKILLS: SkillNode[] = [
  {
    id: "sql-joins",
    name: "SQL Joins",
    domain: "data-science",
    description: "",
    prereqs: [],
  },
  {
    id: "sql-basics",
    name: "SQL Basics",
    domain: "data-science",
    description: "",
    prereqs: [],
  },
  {
    id: "dashboarding",
    name: "Dashboarding",
    domain: "data-science",
    description: "",
    prereqs: [],
  },
  {
    id: "data-visualization",
    name: "Data Visualization",
    domain: "data-science",
    description: "",
    prereqs: [],
  },
  {
    id: "supervised-learning",
    name: "Supervised Learning",
    domain: "data-science",
    description: "",
    prereqs: [],
  },
  {
    id: "model-evaluation",
    name: "Model Evaluation",
    domain: "data-science",
    description: "",
    prereqs: [],
  },
  {
    id: "html-basics",
    name: "HTML Basics",
    domain: "web-dev",
    description: "",
    prereqs: [],
  },
  {
    id: "css-basics",
    name: "CSS Basics",
    domain: "web-dev",
    description: "",
    prereqs: [],
  },
  {
    id: "css-layout",
    name: "CSS Layout",
    domain: "web-dev",
    description: "",
    prereqs: [],
  },
  {
    id: "javascript-basics",
    name: "JavaScript Basics",
    domain: "web-dev",
    description: "",
    prereqs: [],
  },
  {
    id: "react-fundamentals",
    name: "React Fundamentals",
    domain: "web-dev",
    description: "",
    prereqs: [],
  },
];

describe("quickMatch", () => {
  it("picks up a skill named directly", () => {
    const out = quickMatch("I want to learn SQL Joins", SKILLS);
    expect(out.goalSkills.map((g) => g.skillId)).toContain("sql-joins");
  });

  it("maps everyday role language onto skills", () => {
    const out = quickMatch("I want to become a data analyst", SKILLS);
    expect(out.goalSkills.length).toBeGreaterThan(0);
    expect(out.goalSkills.map((g) => g.skillId)).toContain("dashboarding");
  });

  it("maps front-end phrasing onto web skills", () => {
    const out = quickMatch("I want to be a frontend developer", SKILLS);
    expect(out.goalSkills.map((g) => g.skillId)).toContain("html-basics");
  });

  it("separates what the learner already has from what they want", () => {
    const out = quickMatch(
      "I already know SQL Basics but I want Dashboarding",
      SKILLS,
    );
    expect(out.statedSkills.map((s) => s.skillId)).toContain("sql-basics");
    expect(out.goalSkills.map((g) => g.skillId)).toContain("dashboarding");
  });

  it("reads hours per week", () => {
    expect(quickMatch("I can do 10 hours a week", SKILLS).hoursPerWeek).toBe(
      10,
    );
    expect(quickMatch("about 6 hrs per week", SKILLS).hoursPerWeek).toBe(6);
  });

  it("reads a deadline in months, weeks or years", () => {
    expect(quickMatch("in about 6 months", SKILLS).deadlineWeeks).toBe(24);
    expect(quickMatch("within 12 weeks", SKILLS).deadlineWeeks).toBe(12);
    expect(quickMatch("over 1 year", SKILLS).deadlineWeeks).toBe(52);
  });

  it("returns nothing for an unrelated message rather than guessing", () => {
    const out = quickMatch("hello there, how are you?", SKILLS);
    expect(out.goalSkills).toEqual([]);
    expect(out.statedSkills).toEqual([]);
  });

  it("ignores skills that are not in the supplied graph", () => {
    const out = quickMatch("I want machine learning", [SKILLS[0]]);
    expect(out.goalSkills).toEqual([]);
  });

  it("does not run away on a long message", () => {
    const out = quickMatch(
      "I want SQL Joins and SQL Basics and Dashboarding and Data Visualization and Supervised Learning and Model Evaluation and HTML Basics",
      SKILLS,
    );
    expect(out.goalSkills.length).toBeLessThanOrEqual(4);
  });

  it("ignores absurd time values", () => {
    expect(
      quickMatch("I can study 500 hours a week", SKILLS).hoursPerWeek,
    ).toBeUndefined();
  });

  it("handles punctuation around a skill name", () => {
    const out = quickMatch("Goal: dashboarding, please!", SKILLS);
    expect(out.goalSkills.map((g) => g.skillId)).toContain("dashboarding");
  });
});
