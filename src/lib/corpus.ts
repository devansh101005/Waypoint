import Papa from "papaparse";
import type { EvalScenario, Resource, SkillNode, SkillRef } from "./types";

/**
 * Parsing and validation for the teammate-authored corpus spreadsheet.
 *
 * This module is the handoff contract with Track B: it accepts exactly the
 * columns documented in docs/02-ARCHITECTURE.md §3.3 and reports every problem
 * with a row number, so a non-coder can fix the sheet without reading code.
 */

export interface RowError {
  file: string;
  row: number | null; // 1-based sheet row (header = row 1)
  column: string | null;
  message: string;
}

export interface ParseResult<T> {
  rows: T[];
  errors: RowError[];
}

const RESOURCE_TYPES = [
  "course",
  "video",
  "article",
  "project",
  "assessment",
] as const;

function rowNum(index: number): number {
  return index + 2; // +1 for zero-index, +1 for the header row
}

function parseCsv(text: string): Record<string, string>[] {
  const out = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  return out.data.filter((r) =>
    Object.values(r).some((v) => (v ?? "").trim() !== ""),
  );
}

/** Parse "slug:level, slug:level" into SkillRefs. */
function parseSkillRefs(
  raw: string,
  known: Set<string>,
  ctx: { file: string; row: number; column: string },
  errors: RowError[],
): SkillRef[] {
  const value = (raw ?? "").trim();
  if (!value) return [];
  const refs: SkillRef[] = [];

  for (const part of value.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const [slugRaw, levelRaw] = token.split(":");
    const slug = (slugRaw ?? "").trim();
    const level = Number((levelRaw ?? "").trim());

    if (!slug) continue;
    if (!known.has(slug)) {
      errors.push({
        ...ctx,
        message: `unknown skill slug "${slug}" — add it to the Skills tab first`,
      });
      continue;
    }
    if (!Number.isInteger(level) || level < 1 || level > 5) {
      errors.push({
        ...ctx,
        message: `"${token}" must be written as slug:level with level between 1 and 5`,
      });
      continue;
    }
    refs.push({ skillId: slug, level });
  }
  return refs;
}

export function parseSkills(
  text: string,
  file = "skills.csv",
): ParseResult<SkillNode> {
  const raw = parseCsv(text);
  const errors: RowError[] = [];
  const rows: SkillNode[] = [];
  const seen = new Set<string>();

  raw.forEach((r, i) => {
    const row = rowNum(i);
    const slug = (r.slug ?? "").trim();
    const name = (r.name ?? "").trim();
    const domain = (r.domain ?? "").trim();

    if (!slug) {
      errors.push({ file, row, column: "slug", message: "slug is required" });
      return;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      errors.push({
        file,
        row,
        column: "slug",
        message: `"${slug}" must be lowercase kebab-case`,
      });
      return;
    }
    if (seen.has(slug)) {
      errors.push({
        file,
        row,
        column: "slug",
        message: `duplicate slug "${slug}"`,
      });
      return;
    }
    if (!name)
      errors.push({ file, row, column: "name", message: "name is required" });
    if (!domain)
      errors.push({
        file,
        row,
        column: "domain",
        message: "domain is required",
      });

    seen.add(slug);
    rows.push({
      id: slug,
      name: name || slug,
      domain: domain || "uncategorised",
      description: (r.description ?? "").trim(),
      prereqs: (r.prereq_slugs ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  });

  // Prereq targets must exist.
  const ids = new Set(rows.map((s) => s.id));
  rows.forEach((s, i) => {
    for (const p of s.prereqs) {
      if (!ids.has(p)) {
        errors.push({
          file,
          row: rowNum(i),
          column: "prereq_slugs",
          message: `prerequisite "${p}" is not a slug in this tab`,
        });
      }
      if (p === s.id) {
        errors.push({
          file,
          row: rowNum(i),
          column: "prereq_slugs",
          message: "a skill cannot require itself",
        });
      }
    }
  });

  for (const cycle of findCycles(rows)) {
    errors.push({
      file,
      row: null,
      column: "prereq_slugs",
      message: `prerequisite cycle: ${cycle.join(" → ")} — the graph must be acyclic`,
    });
  }

  return { rows, errors };
}

/** Every cycle is fatal: the planner's feasibility argument depends on a DAG. */
export function findCycles(skills: SkillNode[]): string[][] {
  const adj = new Map(skills.map((s) => [s.id, s.prereqs]));
  const state = new Map<string, 0 | 1 | 2>(); // 0 unseen, 1 in stack, 2 done
  const cycles: string[][] = [];
  const stack: string[] = [];

  const visit = (id: string) => {
    const st = state.get(id) ?? 0;
    if (st === 2) return;
    if (st === 1) {
      const start = stack.indexOf(id);
      if (start !== -1) cycles.push([...stack.slice(start), id]);
      return;
    }
    state.set(id, 1);
    stack.push(id);
    for (const next of adj.get(id) ?? []) {
      if (adj.has(next)) visit(next);
    }
    stack.pop();
    state.set(id, 2);
  };

  for (const s of skills) visit(s.id);
  return cycles;
}

export function parseResources(
  text: string,
  skillIds: Set<string>,
  file = "resources.csv",
): ParseResult<Resource> {
  const raw = parseCsv(text);
  const errors: RowError[] = [];
  const rows: Resource[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Map<string, number>();

  raw.forEach((r, i) => {
    const row = rowNum(i);
    const id = (r.id ?? "").trim();
    const title = (r.title ?? "").trim();
    const url = (r.url ?? "").trim();
    const type = (r.type ?? "").trim().toLowerCase();
    const difficulty = Number((r.difficulty ?? "").trim());
    const estHours = Number((r.est_hours ?? "").trim());
    const quality = Number((r.quality ?? "3").trim());

    if (!id) {
      errors.push({
        file,
        row,
        column: "id",
        message: "id is required (format RES-001)",
      });
      return;
    }
    if (!/^RES-\d{3,}$/.test(id)) {
      errors.push({
        file,
        row,
        column: "id",
        message: `"${id}" must look like RES-001`,
      });
      return;
    }
    if (seenIds.has(id)) {
      errors.push({ file, row, column: "id", message: `duplicate id "${id}"` });
      return;
    }
    seenIds.add(id);

    if (!title)
      errors.push({ file, row, column: "title", message: "title is required" });
    if (!url)
      errors.push({ file, row, column: "url", message: "url is required" });
    else {
      const prior = seenUrls.get(url);
      if (prior) {
        errors.push({
          file,
          row,
          column: "url",
          message: `duplicate url — already used on row ${prior}`,
        });
      } else seenUrls.set(url, row);
    }

    if (!RESOURCE_TYPES.includes(type as (typeof RESOURCE_TYPES)[number])) {
      errors.push({
        file,
        row,
        column: "type",
        message: `type must be one of ${RESOURCE_TYPES.join(", ")} (got "${type}")`,
      });
    }
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
      errors.push({
        file,
        row,
        column: "difficulty",
        message: "difficulty must be a whole number 1-5",
      });
    }
    if (!Number.isFinite(estHours) || estHours <= 0) {
      errors.push({
        file,
        row,
        column: "est_hours",
        message: "est_hours must be a number greater than 0",
      });
    }
    if (!Number.isInteger(quality) || quality < 1 || quality > 5) {
      errors.push({
        file,
        row,
        column: "quality",
        message: "quality must be a whole number 1-5",
      });
    }

    const teaches = parseSkillRefs(
      r.skills_taught ?? "",
      skillIds,
      { file, row, column: "skills_taught" },
      errors,
    );
    const requires = parseSkillRefs(
      r.skills_required ?? "",
      skillIds,
      { file, row, column: "skills_required" },
      errors,
    );
    if (teaches.length === 0) {
      errors.push({
        file,
        row,
        column: "skills_taught",
        message:
          "at least one taught skill is required, or this resource can never be recommended",
      });
    }
    // A resource may both require and teach a skill (deepening it), but only if
    // it takes the learner higher than the level it demands going in.
    for (const t of teaches) {
      const req = requires.find((q) => q.skillId === t.skillId);
      if (req && req.level >= t.level) {
        errors.push({
          file,
          row,
          column: "skills_required",
          message:
            `"${t.skillId}" is required at level ${req.level} but only taught to level ${t.level} — ` +
            `raise the taught level or drop it from skills_required`,
        });
      }
    }

    rows.push({
      id,
      title,
      url,
      provider: (r.provider ?? "").trim(),
      type: (RESOURCE_TYPES.includes(type as (typeof RESOURCE_TYPES)[number])
        ? type
        : "course") as Resource["type"],
      description: (r.description ?? "").trim(),
      difficulty: Number.isFinite(difficulty) ? difficulty : 3,
      estHours: Number.isFinite(estHours) ? estHours : 1,
      quality: Number.isFinite(quality) ? quality : 3,
      teaches,
      requires,
    });
  });

  return { rows, errors };
}

export function parseScenarios(
  text: string,
  skillIds: Set<string>,
  resourceIds: Set<string>,
  file = "scenarios.csv",
): ParseResult<EvalScenario> {
  const raw = parseCsv(text);
  const errors: RowError[] = [];
  const rows: EvalScenario[] = [];
  const seen = new Set<string>();

  raw.forEach((r, i) => {
    const row = rowNum(i);
    const id = (r.scenario_id ?? "").trim();
    const goal = (r.goal ?? "").trim();

    if (!/^SCN-\d{2,}$/.test(id)) {
      errors.push({
        file,
        row,
        column: "scenario_id",
        message: `"${id}" must look like SCN-01`,
      });
      return;
    }
    if (seen.has(id)) {
      errors.push({
        file,
        row,
        column: "scenario_id",
        message: `duplicate scenario_id "${id}"`,
      });
      return;
    }
    seen.add(id);
    if (!goal)
      errors.push({ file, row, column: "goal", message: "goal is required" });

    const statedSkills = parseSkillRefs(
      r.stated_skills ?? "",
      skillIds,
      { file, row, column: "stated_skills" },
      errors,
    );

    const expertPath = (r.expert_path ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (expertPath.length === 0) {
      errors.push({
        file,
        row,
        column: "expert_path",
        message:
          "expert_path is required — this is the ground truth the eval scores against",
      });
    }
    for (const rid of expertPath) {
      if (!resourceIds.has(rid)) {
        errors.push({
          file,
          row,
          column: "expert_path",
          message: `"${rid}" is not an id in the Resources tab`,
        });
      }
    }

    const hoursPerWeek = Number((r.hours_per_week ?? "5").trim());

    rows.push({
      id,
      persona: {
        personaName: (r.persona_name ?? "").trim() || id,
        background: (r.background ?? "").trim(),
        statedSkills,
        hoursPerWeek:
          Number.isFinite(hoursPerWeek) && hoursPerWeek > 0 ? hoursPerWeek : 5,
      },
      goal,
      expertPath,
      rationale: (r.rationale ?? "").trim(),
    });
  });

  return { rows, errors };
}

/** Human-readable error report for a non-coder to act on. */
export function formatErrors(errors: RowError[]): string {
  if (errors.length === 0) return "No problems found.";
  const byFile = new Map<string, RowError[]>();
  for (const e of errors) {
    const list = byFile.get(e.file) ?? [];
    list.push(e);
    byFile.set(e.file, list);
  }
  const lines: string[] = [];
  for (const [file, list] of byFile) {
    lines.push(
      `\n${file} — ${list.length} problem${list.length === 1 ? "" : "s"}:`,
    );
    for (const e of list) {
      const where = e.row ? `row ${e.row}` : "whole sheet";
      const col = e.column ? `, column "${e.column}"` : "";
      lines.push(`  • ${where}${col}: ${e.message}`);
    }
  }
  return lines.join("\n");
}
