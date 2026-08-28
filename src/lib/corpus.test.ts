import { describe, expect, it } from "vitest";
import {
  findCycles,
  parseResources,
  parseScenarios,
  parseSkills,
} from "./corpus";

const SKILLS_HEADER = "slug,name,domain,prereq_slugs,description";
const RES_HEADER =
  "id,title,url,provider,type,description,difficulty,est_hours,skills_taught,skills_required,quality,notes";
const SCN_HEADER =
  "scenario_id,persona_name,background,stated_skills,goal,expert_path,rationale,hours_per_week";

function skillsCsv(...rows: string[]) {
  return [SKILLS_HEADER, ...rows].join("\n");
}
function resourcesCsv(...rows: string[]) {
  return [RES_HEADER, ...rows].join("\n");
}

describe("parseSkills", () => {
  it("parses valid rows with prerequisites", () => {
    const { rows, errors } = parseSkills(
      skillsCsv(
        "sql-basics,SQL Basics,data,,Selects",
        'sql-joins,SQL Joins,data,sql-basics,"Joins, etc"',
      ),
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[1].prereqs).toEqual(["sql-basics"]);
  });

  it("rejects non-kebab-case slugs", () => {
    const { errors } = parseSkills(skillsCsv("SQL_Basics,SQL Basics,data,,x"));
    expect(errors[0].message).toContain("kebab-case");
    expect(errors[0].row).toBe(2);
  });

  it("flags duplicate slugs with the offending row", () => {
    const { errors } = parseSkills(
      skillsCsv("a-skill,A,data,,x", "a-skill,A again,data,,x"),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(3);
    expect(errors[0].message).toContain("duplicate");
  });

  it("flags prerequisites that are not defined in the tab", () => {
    const { errors } = parseSkills(skillsCsv("a-skill,A,data,ghost-skill,x"));
    expect(errors[0].column).toBe("prereq_slugs");
    expect(errors[0].message).toContain("ghost-skill");
  });

  it("rejects self-referencing prerequisites", () => {
    const { errors } = parseSkills(skillsCsv("a-skill,A,data,a-skill,x"));
    expect(
      errors.some((e) => e.message.includes("cannot require itself")),
    ).toBe(true);
  });

  it("detects prerequisite cycles", () => {
    const { errors } = parseSkills(
      skillsCsv("a,A,data,c,x", "b,B,data,a,x", "c,C,data,b,x"),
    );
    expect(errors.some((e) => e.message.includes("cycle"))).toBe(true);
  });
});

describe("findCycles", () => {
  it("returns nothing for a DAG", () => {
    expect(
      findCycles([
        { id: "a", name: "A", domain: "d", description: "", prereqs: [] },
        { id: "b", name: "B", domain: "d", description: "", prereqs: ["a"] },
        {
          id: "c",
          name: "C",
          domain: "d",
          description: "",
          prereqs: ["a", "b"],
        },
      ]),
    ).toEqual([]);
  });

  it("finds a two-node cycle", () => {
    const cycles = findCycles([
      { id: "a", name: "A", domain: "d", description: "", prereqs: ["b"] },
      { id: "b", name: "B", domain: "d", description: "", prereqs: ["a"] },
    ]);
    expect(cycles.length).toBeGreaterThan(0);
  });
});

describe("parseResources", () => {
  const known = new Set(["sql-basics", "sql-joins"]);

  it("parses a valid resource with taught and required skills", () => {
    const { rows, errors } = parseResources(
      resourcesCsv(
        'RES-001,SQL Course,https://x.dev,Provider,course,"Teaches SQL.",2,10,sql-joins:3,sql-basics:2,4,',
      ),
      known,
    );
    expect(errors).toEqual([]);
    expect(rows[0].teaches).toEqual([{ skillId: "sql-joins", level: 3 }]);
    expect(rows[0].requires).toEqual([{ skillId: "sql-basics", level: 2 }]);
  });

  it("rejects unknown skill slugs and names them", () => {
    const { errors } = parseResources(
      resourcesCsv('RES-001,T,https://x.dev,P,course,"d",2,10,ghost:3,,4,'),
      known,
    );
    expect(errors[0].message).toContain("ghost");
  });

  it("rejects out-of-range levels", () => {
    const { errors } = parseResources(
      resourcesCsv('RES-001,T,https://x.dev,P,course,"d",2,10,sql-joins:9,,4,'),
      known,
    );
    expect(errors.some((e) => e.message.includes("between 1 and 5"))).toBe(
      true,
    );
  });

  it("rejects a bad resource type", () => {
    const { errors } = parseResources(
      resourcesCsv(
        'RES-001,T,https://x.dev,P,webinar,"d",2,10,sql-joins:3,,4,',
      ),
      known,
    );
    expect(errors.some((e) => e.column === "type")).toBe(true);
  });

  it("flags duplicate urls across rows", () => {
    const { errors } = parseResources(
      resourcesCsv(
        'RES-001,A,https://same.dev,P,course,"d",2,10,sql-joins:3,,4,',
        'RES-002,B,https://same.dev,P,course,"d",2,10,sql-joins:3,,4,',
      ),
      known,
    );
    expect(
      errors.some((e) => e.column === "url" && e.message.includes("duplicate")),
    ).toBe(true);
  });

  it("requires at least one taught skill", () => {
    const { errors } = parseResources(
      resourcesCsv('RES-001,T,https://x.dev,P,course,"d",2,10,,,4,'),
      known,
    );
    expect(errors.some((e) => e.column === "skills_taught")).toBe(true);
  });

  it("allows a resource that deepens a skill it also requires", () => {
    const { errors } = parseResources(
      resourcesCsv(
        'RES-001,T,https://x.dev,P,course,"d",3,10,sql-joins:4,sql-joins:2,4,',
      ),
      known,
    );
    expect(errors).toEqual([]);
  });

  it("rejects a resource that teaches no higher than it requires", () => {
    const { errors } = parseResources(
      resourcesCsv(
        'RES-001,T,https://x.dev,P,course,"d",2,10,sql-joins:3,sql-joins:3,4,',
      ),
      known,
    );
    expect(errors.some((e) => e.message.includes("only taught to level"))).toBe(
      true,
    );
  });

  it("handles quoted descriptions containing commas", () => {
    const { rows, errors } = parseResources(
      resourcesCsv(
        'RES-001,T,https://x.dev,P,course,"Covers joins, unions, and CTEs.",2,10,sql-joins:3,,4,',
      ),
      known,
    );
    expect(errors).toEqual([]);
    expect(rows[0].description).toBe("Covers joins, unions, and CTEs.");
  });
});

describe("parseScenarios", () => {
  const skills = new Set(["sql-basics"]);
  const resources = new Set(["RES-001", "RES-002"]);

  it("parses a valid scenario", () => {
    const { rows, errors } = parseScenarios(
      [
        SCN_HEADER,
        'SCN-01,Riya,"A grad.",sql-basics:2,Become an analyst,"RES-001, RES-002",Because.,8',
      ].join("\n"),
      skills,
      resources,
    );
    expect(errors).toEqual([]);
    expect(rows[0].expertPath).toEqual(["RES-001", "RES-002"]);
    expect(rows[0].persona.hoursPerWeek).toBe(8);
  });

  it("rejects expert paths referencing unknown resources", () => {
    const { errors } = parseScenarios(
      [SCN_HEADER, "SCN-01,Riya,bg,sql-basics:2,Goal,RES-999,Because.,8"].join(
        "\n",
      ),
      skills,
      resources,
    );
    expect(errors.some((e) => e.message.includes("RES-999"))).toBe(true);
  });

  it("requires a non-empty expert path", () => {
    const { errors } = parseScenarios(
      [SCN_HEADER, "SCN-01,Riya,bg,sql-basics:2,Goal,,Because.,8"].join("\n"),
      skills,
      resources,
    );
    expect(errors.some((e) => e.column === "expert_path")).toBe(true);
  });
});
