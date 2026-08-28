import { readFileSync } from "node:fs";
import type { Metadata } from "next";
import path from "node:path";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EvalMetrics } from "@/lib/types";

interface EvalReport {
  generatedAt: string;
  mode: "embeddings" | "lexical";
  corpus: { skills: number; resources: number };
  summary: { ours: EvalMetrics; baseline: EvalMetrics };
  scenarios: Array<{
    id: string;
    persona: string;
    ours: EvalMetrics;
    baseline: EvalMetrics;
  }>;
  skipped: string[];
}

function loadReport(): EvalReport | null {
  try {
    const file = path.join(process.cwd(), "eval-results", "eval.json");
    return JSON.parse(readFileSync(file, "utf8")) as EvalReport;
  } catch {
    return null;
  }
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const num = (n: number) => n.toFixed(3);

const METRICS: Array<{
  label: string;
  pick: (m: EvalMetrics) => number;
  lowerIsBetter: boolean;
  format: (n: number) => string;
  note: string;
}> = [
  {
    label: "Prerequisite violations",
    pick: (m) => m.prereqViolationRate,
    lowerIsBetter: true,
    format: pct,
    note: "Steps the learner was not ready for when they reached them.",
  },
  {
    label: "Gap coverage",
    pick: (m) => m.gapCoverage,
    lowerIsBetter: false,
    format: pct,
    note: "How much of the learner's skill gap the path actually closes.",
  },
  {
    label: "Redundancy",
    pick: (m) => m.redundancy,
    lowerIsBetter: true,
    format: pct,
    note: "Teaching effort spent on skills the learner already held.",
  },
  {
    label: "nDCG vs. expert",
    pick: (m) => m.ndcg,
    lowerIsBetter: false,
    format: num,
    note: "Agreement with the resources a human expert chose.",
  },
  {
    label: "Ordering correlation",
    pick: (m) => m.kendallTau,
    lowerIsBetter: false,
    format: num,
    note: "Kendall tau against the expert's ordering of the same items.",
  },
];

export const metadata: Metadata = {
  title: "Evaluation — Waypoint",
  description:
    "How Waypoint's planner scores against a similarity baseline on hand-labelled expert learning paths.",
};

export default function EvalPage() {
  const report = loadReport();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-10 space-y-4">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          ← Waypoint
        </Link>
        <h1 className="text-3xl font-semibold text-balance sm:text-4xl">
          Does it actually beat similarity search?
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">
          Every recommender claims good results. This page is the receipt: our
          planner and a similarity baseline, run over the same corpus and scored
          against learning paths a human expert wrote by hand.
        </p>
      </header>

      {!report ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
          No evaluation results yet. Run{" "}
          <code className="font-mono">npm run eval -- --json</code> to generate
          them.
        </p>
      ) : (
        <div className="space-y-10">
          <section className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{report.corpus.skills} skills</Badge>
            <Badge variant="secondary">
              {report.corpus.resources} resources
            </Badge>
            <Badge variant="secondary">
              {report.scenarios.length} expert-labelled scenarios
            </Badge>
            <Badge
              variant={report.mode === "embeddings" ? "secondary" : "outline"}
            >
              {report.mode === "embeddings"
                ? "embedding baseline"
                : "lexical baseline"}
            </Badge>
          </section>

          {report.mode === "lexical" && (
            <p className="border-l-2 border-amber-600 py-2 pl-4 text-sm dark:border-amber-400">
              <strong>Provisional.</strong> No embedding key was configured, so
              the baseline ranked by word overlap. That understates it — a goal
              phrased as &ldquo;become a front-end developer&rdquo; shares no
              words with a course about &ldquo;document structure and
              semantics&rdquo;. The prerequisite result below is structural and
              will hold; the relevance scores will narrow once the baseline gets
              embeddings.
            </p>
          )}

          <section aria-labelledby="headline">
            <h2 id="headline" className="mb-4 text-xl font-semibold">
              Headline
            </h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">Waypoint</TableHead>
                    <TableHead className="text-right">Baseline</TableHead>
                    <TableHead className="text-right">Winner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {METRICS.map((metric) => {
                    const ours = metric.pick(report.summary.ours);
                    const base = metric.pick(report.summary.baseline);
                    const tie = Math.abs(ours - base) < 1e-9;
                    const weWin = metric.lowerIsBetter
                      ? ours < base
                      : ours > base;
                    return (
                      <TableRow key={metric.label}>
                        <TableCell>
                          <span className="font-medium">{metric.label}</span>
                          <span className="text-muted-foreground block text-xs">
                            {metric.note}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {metric.format(ours)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right font-mono tabular-nums">
                          {metric.format(base)}
                        </TableCell>
                        <TableCell className="text-right">
                          {tie ? (
                            <span className="text-muted-foreground text-xs">
                              tie
                            </span>
                          ) : weWin ? (
                            <Badge>Waypoint</Badge>
                          ) : (
                            <Badge variant="outline">baseline</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell className="font-medium">
                      Hours prescribed
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {report.summary.ours.totalHours.toFixed(0)}h
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-mono tabular-nums">
                      {report.summary.baseline.totalHours.toFixed(0)}h
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-xs">
                      —
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </section>

          <section aria-labelledby="per-scenario">
            <h2 id="per-scenario" className="mb-4 text-xl font-semibold">
              Per scenario
            </h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Learner</TableHead>
                    <TableHead className="text-right">Violations</TableHead>
                    <TableHead className="text-right">Coverage</TableHead>
                    <TableHead className="text-right">nDCG</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.scenarios.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <span className="font-medium">{s.persona}</span>
                        <span className="text-muted-foreground block text-xs">
                          {s.id}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {pct(s.ours.prereqViolationRate)}
                        <span className="text-muted-foreground">
                          {" / "}
                          {pct(s.baseline.prereqViolationRate)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {pct(s.ours.gapCoverage)}
                        <span className="text-muted-foreground">
                          {" / "}
                          {pct(s.baseline.gapCoverage)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {num(s.ours.ndcg)}
                        <span className="text-muted-foreground">
                          {" / "}
                          {num(s.baseline.ndcg)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              Each cell reads Waypoint / baseline.
            </p>
          </section>

          <footer className="text-muted-foreground border-t pt-6 text-sm">
            Generated {new Date(report.generatedAt).toLocaleString("en-IN")} by{" "}
            <code className="font-mono">npm run eval</code>. Re-runnable on any
            machine from the CSVs in <code className="font-mono">data/</code>.
          </footer>
        </div>
      )}
    </main>
  );
}
