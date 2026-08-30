/**
 * Evaluation harness: our planner vs. the similarity baseline, scored against
 * hand-labelled expert paths.
 *
 *   npm run eval                       # bootstrap corpus + seed scenarios
 *   npm run eval -- --corpus data/live # a directory holding the three CSVs
 *   npm run eval -- --json             # machine-readable output as well
 *
 * Runs from CSV with no database, so the numbers can be regenerated on any
 * machine — including a judge's. When COHERE_API_KEY is set the baseline is
 * given real embeddings, which is the only version of this comparison worth
 * publishing; without a key it falls back to lexical similarity and the report
 * says so, because a baseline crippled by vocabulary mismatch would make our
 * own numbers meaningless.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { baselinePath, lexicalSimilarities } from "../src/lib/baseline";
import {
  formatErrors,
  parseResources,
  parseScenarios,
  parseSkills,
} from "../src/lib/corpus";
import {
  cosine,
  embedDocuments,
  embedQuery,
  resourceCard,
} from "../src/lib/embeddings";
import { env } from "../src/lib/env";
import { evaluatePath, macroAverage } from "../src/lib/eval";
import { computeGap } from "../src/lib/gap";
import { extractIntake } from "../src/lib/intake";
import { buildGraph } from "../src/lib/graph";
import { buildMastery } from "../src/lib/mastery";
import { planPath } from "../src/lib/planner";
import { scoreResource } from "../src/lib/scoring";
import type {
  EvalMetrics,
  EvalScenario,
  Resource,
  ScoreBreakdown,
  SkillRef,
} from "../src/lib/types";

config({ path: ".env.local" });

function flag(name: string, fallback = ""): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? (process.argv[i + 1] ?? fallback) : fallback;
}

async function main() {
  const corpusDir = flag("corpus") || path.join("data", "bootstrap");
  const outDir = flag("out") || "eval-results";

  const skillsResult = parseSkills(
    readFileSync(path.join(corpusDir, "skills.csv"), "utf8"),
  );
  const skillIds = new Set(skillsResult.rows.map((s) => s.id));
  const resourcesResult = parseResources(
    readFileSync(path.join(corpusDir, "resources.csv"), "utf8"),
    skillIds,
  );
  const resourceIds = new Set(resourcesResult.rows.map((r) => r.id));

  const scenariosPath = path.join(corpusDir, "scenarios.csv");
  if (!existsSync(scenariosPath)) {
    console.error(
      `No scenarios.csv in ${corpusDir}. The harness scores against hand-labelled`,
    );
    console.error("paths; without them there is nothing to compare against.");
    process.exit(1);
  }
  const scenariosResult = parseScenarios(
    readFileSync(scenariosPath, "utf8"),
    skillIds,
    resourceIds,
  );

  const errors = [
    ...skillsResult.errors,
    ...resourcesResult.errors,
    ...scenariosResult.errors,
  ];
  if (errors.length) {
    console.error("Corpus is invalid; fix these before evaluating:");
    console.error(formatErrors(errors));
    process.exit(1);
  }

  const graph = buildGraph(skillsResult.rows);
  const resources = resourcesResult.rows;

  // Embed the corpus once, if we can. Both systems then see the same vectors.
  let corpusVectors: Map<string, number[]> | null = null;
  if (env.hasCohere) {
    process.stdout.write("Embedding corpus for the baseline… ");
    const vectors = await embedDocuments(resources.map(resourceCard));
    if (vectors) {
      corpusVectors = new Map(resources.map((r, i) => [r.id, vectors[i]]));
      console.log(`${vectors.length} resources embedded.`);
    } else {
      console.log("failed; falling back to lexical similarity.");
    }
  }
  const mode = corpusVectors ? "embeddings" : "lexical";

  async function similaritiesFor(queryText: string, pool: Resource[]) {
    if (corpusVectors) {
      const q = await embedQuery(queryText);
      if (q) {
        return new Map(
          pool.map((r) => [r.id, cosine(q, corpusVectors!.get(r.id) ?? [])]),
        );
      }
    }
    return lexicalSimilarities(pool, queryText);
  }

  /**
   * Goal skills come from the scenario when the sheet supplies them. It usually
   * does not — asking a non-coder to name skill slugs was never part of the
   * brief — so they are resolved by running the same intake extraction the
   * product uses on the learner's own words.
   *
   * That is the honest way round: hand-feeding the planner its target would
   * quietly evaluate a pipeline nobody actually runs. Resolutions are cached to
   * disk so a re-run costs nothing, and written out in full so the extraction
   * can be inspected rather than trusted.
   */
  const cachePath = path.join(outDir, "resolved-goals.json");
  let cache: Record<string, SkillRef[]> = {};
  try {
    cache = JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, SkillRef[]>;
  } catch {
    /* first run */
  }

  const resolvedBy: Record<string, "sheet" | "cache" | "model"> = {};
  /**
   * Scenarios where the intake asked for clarification instead of committing to
   * a destination. That is correct behaviour on a deliberately vague goal, and
   * reporting it as a plain "skipped" would read as a failure of the system
   * rather than a demonstration of it.
   */
  const clarified: Record<string, string> = {};

  async function goalSkillsFor(scenario: EvalScenario): Promise<SkillRef[] | null> {
    const fromSheet = (scenario.goalSkills ?? []).filter((g) => graph.has(g.skillId));
    if (fromSheet.length > 0) {
      resolvedBy[scenario.id] = "sheet";
      return fromSheet;
    }

    const cached = (cache[scenario.id] ?? []).filter((g) => graph.has(g.skillId));
    if (cached.length > 0) {
      resolvedBy[scenario.id] = "cache";
      return cached;
    }

    process.stdout.write(`  resolving ${scenario.id} via intake extraction… `);
    try {
      const intake = await extractIntake(
        [
          {
            role: "user",
            content: `${scenario.persona.background}

What I want: ${scenario.goal}`,
          },
        ],
        graph,
      );
      if (intake.goalSkills.length === 0) {
        // Say why. A silent skip here quietly removes a scenario from the
        // published numbers, which is the last place to be vague.
        const reasons: string[] = [];
        if (intake.droppedSkills.length > 0) {
          reasons.push(`invented slugs dropped: ${intake.droppedSkills.join(", ")}`);
        }
        if (intake.followUpQuestion) {
          clarified[scenario.id] = intake.followUpQuestion;
          reasons.push(`asked instead: "${intake.followUpQuestion}"`);
        }
        console.log(`no goal skills resolved${reasons.length ? ` — ${reasons.join("; ")}` : ""}`);
        return null;
      }
      cache[scenario.id] = intake.goalSkills;
      resolvedBy[scenario.id] = "model";
      console.log(intake.goalSkills.map((g) => `${g.skillId}:${g.level}`).join(", "));
      return intake.goalSkills;
    } catch (error) {
      console.log(`failed — ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  const perScenario: Array<{
    scenario: EvalScenario;
    ours: EvalMetrics;
    baseline: EvalMetrics;
  }> = [];
  const skipped: string[] = [];

  for (const scenario of scenariosResult.rows) {
    const goalSkills = await goalSkillsFor(scenario);
    if (!goalSkills) {
      skipped.push(scenario.id);
      continue;
    }

    const startMastery = buildMastery({
      stated: scenario.persona.statedSkills,
    });
    const gap = computeGap(goalSkills, startMastery, graph);
    const similarity = await similaritiesFor(scenario.goal, resources);

    const scores = new Map<string, ScoreBreakdown>(
      resources.map((r) => [
        r.id,
        scoreResource(
          r,
          gap,
          corpusVectors ? { dense: similarity.get(r.id) ?? 0 } : {},
        ),
      ]),
    );

    const ours = planPath({
      goalSkills,
      mastery: startMastery,
      graph,
      resources,
      scores,
      maxItems: Math.max(scenario.expertPath.length, 8),
    });

    // Same corpus, same query the learner typed, same similarity signal.
    const baseline = baselinePath(resources, scenario.goal, {
      k: scenario.expertPath.length,
      similarity,
    });

    const input = {
      goalSkills,
      startMastery,
      graph,
      expertPath: scenario.expertPath,
    };
    perScenario.push({
      scenario,
      ours: evaluatePath("Waypoint", ours, input),
      baseline: evaluatePath("Similarity baseline", baseline, input),
    });
  }

  if (perScenario.length === 0) {
    console.error(
      "No scenarios could be scored (none had resolvable goal skills).",
    );
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}
`, "utf8");

  const oursAvg = macroAverage(perScenario.map((r) => r.ours));
  const baseAvg = macroAverage(perScenario.map((r) => r.baseline));

  // ---------- report ----------

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const num = (n: number) => n.toFixed(3);

  const lines: string[] = [];
  lines.push("# Evaluation: Waypoint vs. similarity baseline\n");
  lines.push(
    `Corpus: **${skillsResult.rows.length} skills**, **${resources.length} resources**. ` +
      `Scored against **${perScenario.length} hand-labelled expert paths**.\n`,
  );
  lines.push(
    "The baseline ranks resources by similarity between the learner's stated goal and each " +
      "resource's text, then presents them in similarity order — no skill tags, no prerequisite " +
      "graph, no model of what the learner already knows. It sees the same corpus and the same " +
      "similarity signal we do.\n",
  );

  if (mode === "lexical") {
    lines.push(
      "> **These numbers are provisional.** No embedding key was configured, so the baseline " +
        "used lexical (term-overlap) similarity. That understates it: a goal phrased as " +
        '"become a front-end developer" shares no words with a course described as "document ' +
        'structure, semantics and forms", so the baseline scores zero on resources it would ' +
        "rank correctly with embeddings. Set `COHERE_API_KEY` and re-run for the comparison " +
        "we intend to publish.\n",
    );
  } else {
    lines.push(
      "_Baseline similarity: Cohere `embed-v4.0`, the same embeddings our retriever uses._\n",
    );
  }

  lines.push("## Headline\n");
  lines.push("| Metric | Waypoint | Baseline | Better |");
  lines.push("|---|---|---|---|");
  const row = (
    label: string,
    ours: number,
    base: number,
    lowerIsBetter: boolean,
    fmt = pct,
  ) => {
    const tie = Math.abs(ours - base) < 1e-9;
    const win = lowerIsBetter ? ours < base : ours > base;
    lines.push(
      `| ${label} | ${fmt(ours)} | ${fmt(base)} | ${tie ? "tie" : win ? "**Waypoint**" : "baseline"} |`,
    );
  };
  row(
    "Prerequisite violation rate",
    oursAvg.prereqViolationRate,
    baseAvg.prereqViolationRate,
    true,
  );
  row("Gap coverage", oursAvg.gapCoverage, baseAvg.gapCoverage, false);
  row("Redundancy", oursAvg.redundancy, baseAvg.redundancy, true);
  row("nDCG vs. expert path", oursAvg.ndcg, baseAvg.ndcg, false, num);
  row(
    "Ordering correlation (Kendall tau)",
    oursAvg.kendallTau,
    baseAvg.kendallTau,
    false,
    num,
  );
  lines.push(
    `| Hours prescribed | ${oursAvg.totalHours.toFixed(1)}h | ${baseAvg.totalHours.toFixed(1)}h | — |`,
  );

  lines.push("\n## Per scenario\n");
  lines.push(
    "| Scenario | Persona | Violations (ours / base) | Coverage (ours / base) | nDCG (ours / base) |",
  );
  lines.push("|---|---|---|---|---|");
  for (const { scenario, ours, baseline } of perScenario) {
    lines.push(
      `| ${scenario.id} | ${scenario.persona.personaName} | ` +
        `${pct(ours.prereqViolationRate)} / ${pct(baseline.prereqViolationRate)} | ` +
        `${pct(ours.gapCoverage)} / ${pct(baseline.gapCoverage)} | ` +
        `${num(ours.ndcg)} / ${num(baseline.ndcg)} |`,
    );
  }

  lines.push("\n## What the metrics mean\n");
  lines.push(
    "- **Prerequisite violation rate** — share of steps the learner was not ready for when they " +
      "reached them. Zero by construction for Waypoint: the prerequisite graph gates which " +
      "resources are generated as candidates, so an infeasible step is never considered.",
  );
  lines.push(
    "- **Gap coverage** — share of the learner's initial skill gap the path actually closes.",
  );
  lines.push(
    "- **Redundancy** — share of teaching effort spent on skills the learner already held.",
  );
  lines.push(
    "- **nDCG / Kendall tau** — agreement with the human expert's chosen resources and ordering.",
  );

  const clarifiedIds = Object.keys(clarified);
  for (const id of clarifiedIds) {
    const scenario = scenariosResult.rows.find((s) => s.id === id);
    lines.push(
      `
**${id} was not scored, and that is the intended behaviour.** Its goal — ` +
        `"${scenario?.goal ?? ""}" — is too vague to compile into a destination, so the intake ` +
        `asked a clarifying question rather than inventing one:

> ${clarified[id]}

` +
        `A system that guessed here would score on this scenario and be wrong in a way nobody ` +
        `could check. There is nothing to compare against an expert path until the learner answers.`,
    );
  }

  const unexplained = skipped.filter((id) => !clarified[id]);
  if (unexplained.length) {
    lines.push(
      `
_Skipped ${unexplained.length} scenario(s) with unresolved goal skills: ${unexplained.join(", ")}._`,
    );
  }
  lines.push(
    `\n_Generated ${new Date().toISOString()} by \`npm run eval\` (${mode} mode)._\n`,
  );

  const report = lines.join("\n");
  console.log(`\n${report}`);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "eval.md"), report, "utf8");
  if (process.argv.includes("--json")) {
    writeFileSync(
      path.join(outDir, "eval.json"),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          mode,
          corpus: {
            skills: skillsResult.rows.length,
            resources: resources.length,
          },
          summary: { ours: oursAvg, baseline: baseAvg },
          scenarios: perScenario.map((r) => ({
            id: r.scenario.id,
            persona: r.scenario.persona.personaName,
            ours: r.ours,
            baseline: r.baseline,
          })),
          skipped,
        },
        null,
        2,
      ),
      "utf8",
    );
  }
  console.log(`Written to ${path.join(outDir, "eval.md")}\n`);
}

main().catch((err) => {
  console.error("Evaluation failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
