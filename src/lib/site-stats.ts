import { readFileSync } from "node:fs";
import path from "node:path";
import { getStore } from "./store";
import type { EvalMetrics } from "./types";

/**
 * Every figure the interface displays, resolved from a real artifact.
 *
 * Corpus counts come from whichever store is live — the database in
 * production, the CSVs otherwise — and the evaluation figures come from the
 * file `npm run eval` writes. Nothing here is typed in by hand, so a corpus
 * import or a re-run of the harness updates the site on its own.
 *
 * Anything that cannot be sourced comes back null, and the caller omits it. A
 * page headed "measured, not claimed" must not display a number that no
 * artifact can back.
 */

export interface EvalSnapshot {
  mode: "embeddings" | "lexical";
  generatedAt: string;
  scenarios: number;
  ours: EvalMetrics;
  baseline: EvalMetrics;
}

export interface SiteStats {
  corpus: {
    skills: number;
    resources: number;
    scenarios: number;
    source: "postgres" | "memory";
  };
  evaluation: EvalSnapshot | null;
  tests: number | null;
}

export async function getSiteStats(): Promise<SiteStats> {
  const store = getStore();
  const [graph, resources, scenarios] = await Promise.all([
    store.graph(),
    store.resources(),
    store.scenarioCount(),
  ]);
  const evaluation = readEvaluation();

  return {
    corpus: {
      skills: graph.all().length,
      resources: resources.length,
      // How many the corpus holds. The harness may score fewer — a deliberately
      // vague goal is answered with a question rather than a guess — so the two
      // counts are reported separately rather than conflated.
      scenarios,
      source: store.kind,
    },
    evaluation,
    tests: readTestCount(),
  };
}

function readEvaluation(): EvalSnapshot | null {
  try {
    const file = path.join(process.cwd(), "eval-results", "eval.json");
    const parsed = JSON.parse(readFileSync(file, "utf8")) as {
      mode: "embeddings" | "lexical";
      generatedAt: string;
      scenarios: unknown[];
      summary: { ours: EvalMetrics; baseline: EvalMetrics };
    };
    return {
      mode: parsed.mode,
      generatedAt: parsed.generatedAt,
      scenarios: parsed.scenarios.length,
      ours: parsed.summary.ours,
      baseline: parsed.summary.baseline,
    };
  } catch {
    return null;
  }
}

/** Written by `npm run stats:tests`. Absent means the figure is not shown. */
function readTestCount(): number | null {
  try {
    const file = path.join(process.cwd(), "eval-results", "tests.json");
    const parsed = JSON.parse(readFileSync(file, "utf8")) as {
      passed?: number;
    };
    return typeof parsed.passed === "number" ? parsed.passed : null;
  } catch {
    return null;
  }
}

// ---------- formatting, shared by every surface that shows these ----------

export function asPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function asScore(value: number): string {
  // Minus sign rather than a hyphen: these sit in tabular figures.
  return value.toFixed(3).replace(/^-/, "−");
}
