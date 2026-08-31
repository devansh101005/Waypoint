import type { Metadata } from "next";
import Link from "next/link";
import { TransitBar } from "@/components/transit/chrome";
import { RouteComparison } from "@/components/transit/comparison";
import { INK, LINE, LINE_INK, PAPER } from "@/components/transit/theme";
import { asPercent, asScore, getSiteStats } from "@/lib/site-stats";
import type { EvalMetrics } from "@/lib/types";

/**
 * The receipt.
 *
 * Every figure is read from the file the harness writes, so this page cannot
 * drift from the run that produced it, and if that file is missing the page
 * says so rather than showing a stale number. The per-scenario table is the
 * part that matters: an average can hide a system that wins on aggregate and
 * loses everywhere a judge would look.
 */

export const metadata: Metadata = {
  title: "Evidence — Waypoint",
  description:
    "How Waypoint's planner scores against a similarity baseline on learning paths written by hand.",
};

const METRICS: Array<{
  label: string;
  note: string;
  pick: (m: EvalMetrics) => number;
  lowerIsBetter: boolean;
  format: (n: number) => string;
}> = [
  {
    label: "PREREQUISITE VIOLATIONS",
    note: "Stops the learner was not ready for when they arrived.",
    pick: (m) => m.prereqViolationRate,
    lowerIsBetter: true,
    format: asPercent,
  },
  {
    label: "SKILL GAP CLOSED",
    note: "How much of the distance to the destination the route covers.",
    pick: (m) => m.gapCoverage,
    lowerIsBetter: false,
    format: asPercent,
  },
  {
    label: "REDUNDANCY",
    note: "Effort spent on skills the learner already had.",
    pick: (m) => m.redundancy,
    lowerIsBetter: true,
    format: asPercent,
  },
  {
    label: "AGREEMENT WITH EXPERT",
    note: "nDCG against the resources a human chose.",
    pick: (m) => m.ndcg,
    lowerIsBetter: false,
    format: asScore,
  },
  {
    label: "ORDERING CORRELATION",
    note: "Kendall tau against the order a human put them in.",
    pick: (m) => m.kendallTau,
    lowerIsBetter: false,
    format: asScore,
  },
];

export default async function EvalPage() {
  const { corpus, evaluation } = await getSiteStats();

  return (
    <div className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <TransitBar line="EVIDENCE" />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="wp-display text-[clamp(2rem,5vw,3.2rem)] leading-[0.95] font-extrabold tracking-[-0.02em]">
          DOES IT ACTUALLY BEAT
          <br />
          SIMILARITY SEARCH?
        </h1>
        <p className="mt-5 max-w-2xl leading-relaxed">
          Every recommender claims good results. This page is the receipt: our
          planner and a semantic search baseline, run over the same corpus,
          scored against learning paths a human expert wrote by hand.
        </p>

        {!evaluation ? (
          <p
            className="mt-10 border-2 border-dashed p-6 font-mono text-sm"
            style={{ borderColor: INK }}
          >
            NO RESULTS RECORDED. RUN <code>npm run eval -- --json</code> TO
            GENERATE THEM.
          </p>
        ) : (
          <div className="mt-10 space-y-12">
            <ul className="flex flex-wrap gap-2 font-mono text-[0.68rem] font-bold tracking-[0.14em]">
              {[
                `${corpus.skills} SKILLS`,
                `${corpus.resources} RESOURCES`,
                `${evaluation.scenarios} OF ${corpus.scenarios} PATHS SCORED`,
                evaluation.mode === "embeddings"
                  ? "EMBEDDING BASELINE"
                  : "LEXICAL BASELINE",
              ].map((chip) => (
                <li
                  key={chip}
                  className="border-2 px-2.5 py-1"
                  style={{ borderColor: INK }}
                >
                  {chip}
                </li>
              ))}
            </ul>

            {evaluation.mode === "lexical" && (
              <p
                className="py-2 pl-4 text-sm"
                style={{ borderLeft: `4px solid ${LINE.accent}` }}
              >
                <strong>Provisional.</strong> No embedding key was configured,
                so the baseline ranked by word overlap. That understates it — a
                goal phrased as &ldquo;become a front-end developer&rdquo;
                shares no words with a course about &ldquo;document structure
                and semantics&rdquo;. The prerequisite result is structural and
                will hold; the relevance figures will narrow once the baseline
                gets embeddings.
              </p>
            )}

            <section aria-labelledby="headline">
              <h2
                id="headline"
                className="wp-display mb-5 text-[clamp(1.3rem,3vw,1.9rem)] font-extrabold tracking-[-0.01em]"
              >
                HEADLINE
              </h2>

              <div
                className="grid gap-px sm:grid-cols-2"
                style={{ background: INK }}
              >
                {METRICS.map((metric) => {
                  const ours = metric.pick(evaluation.ours);
                  const base = metric.pick(evaluation.baseline);
                  const weWin = metric.lowerIsBetter
                    ? ours < base
                    : ours > base;
                  return (
                    <div
                      key={metric.label}
                      className="p-5"
                      style={{ background: PAPER }}
                    >
                      <p className="font-mono text-[0.64rem] font-bold tracking-[0.16em]">
                        {metric.label}
                      </p>
                      <p className="mt-3 flex items-baseline gap-4">
                        <span
                          className="wp-display text-[clamp(2rem,4.5vw,2.9rem)] leading-none font-extrabold tabular-nums"
                          style={{ color: weWin ? LINE_INK.data : INK }}
                        >
                          {metric.format(ours)}
                        </span>
                        <span className="font-mono text-sm tabular-nums opacity-60">
                          vs {metric.format(base)}
                        </span>
                      </p>
                      <p className="mt-2 text-[0.82rem] leading-snug opacity-75">
                        {metric.note}
                      </p>
                    </div>
                  );
                })}

                <div className="p-5" style={{ background: PAPER }}>
                  <p className="font-mono text-[0.64rem] font-bold tracking-[0.16em]">
                    HOURS PRESCRIBED
                  </p>
                  <p className="mt-3 flex items-baseline gap-4">
                    <span className="wp-display text-[clamp(2rem,4.5vw,2.9rem)] leading-none font-extrabold tabular-nums">
                      {evaluation.ours.totalHours.toFixed(0)}h
                    </span>
                    <span className="font-mono text-sm tabular-nums opacity-60">
                      vs {evaluation.baseline.totalHours.toFixed(0)}h
                    </span>
                  </p>
                  <p className="mt-2 text-[0.82rem] leading-snug opacity-75">
                    Average study time each route asks for.
                  </p>
                </div>
              </div>
            </section>

            {evaluation.comparisons.length > 0 && (
              <section aria-labelledby="side-by-side">
                <h2
                  id="side-by-side"
                  className="wp-display mb-3 text-[clamp(1.3rem,3vw,1.9rem)] font-extrabold tracking-[-0.01em]"
                >
                  THE SAME LEARNER, ROUTED TWO WAYS
                </h2>
                <p className="mb-7 max-w-3xl leading-relaxed">
                  A violation rate is a number you have to trust. This is the
                  same figure with the routes attached: pick a learner and see
                  which steps each approach puts in front of them before they
                  are ready, and exactly which skill they are missing.
                </p>
                <RouteComparison comparisons={evaluation.comparisons} />
              </section>
            )}

            <section aria-labelledby="reading">
              <h2
                id="reading"
                className="wp-display mb-4 text-[clamp(1.3rem,3vw,1.9rem)] font-extrabold tracking-[-0.01em]"
              >
                HOW TO READ THIS
              </h2>
              <p className="max-w-3xl leading-relaxed">
                The ordering correlation is the one worth staring at. A value of{" "}
                <strong>{asScore(evaluation.baseline.kendallTau)}</strong> means
                the baseline&apos;s sequence has no relationship to the
                expert&apos;s — it retrieves reasonable material and then hands
                it over in an order nobody could learn from. Ordering is the
                whole problem, and similarity search has no concept of it.
              </p>
              <p className="mt-4 max-w-3xl leading-relaxed">
                The prerequisite violation rate is zero by construction rather
                than by tuning: the graph gates which resources are generated as
                candidates at each step, so an infeasible stop is never
                considered in the first place.
              </p>
              <p className="mt-5 font-mono text-[0.72rem] opacity-70">
                GENERATED{" "}
                {new Date(evaluation.generatedAt).toISOString().slice(0, 10)} BY{" "}
                <code>npm run eval</code> · CORPUS READ FROM{" "}
                {corpus.source.toUpperCase()}
              </p>
            </section>

            <p className="font-mono text-[0.75rem] tracking-[0.08em]">
              <Link href="/start" className="underline underline-offset-4">
                PLOT YOUR OWN ROUTE →
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
