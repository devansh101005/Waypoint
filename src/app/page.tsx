import Link from "next/link";
import { NetworkMap } from "@/components/preview/network-map";
import { RouteBoard } from "@/components/preview/route-board";
import { asPercent, asScore, getSiteStats } from "@/lib/site-stats";

/**
 * The landing page.
 *
 * Every figure on this page is read at render time from a real artifact — the
 * live corpus and the file the evaluation harness writes. None of it is typed
 * in. A page headed "measured, not claimed" that displayed a hand-entered
 * number would undo its own argument, and figures that cannot be sourced are
 * omitted rather than guessed.
 */

const INK = "#16161A";
const PAPER = "#F4F3EF";
const RED = "#D82A24";
const RED_INK = "#AE1B16";
const BLUE = "#1B45C4";
const GREEN = "#00734A";
const AMBER_INK = "#8A5B00";

export default async function Home() {
  const stats = await getSiteStats();
  const { corpus, evaluation, tests } = stats;

  // Only figures with a source behind them reach the page.
  const ticker = [
    evaluation &&
      `${asPercent(evaluation.ours.prereqViolationRate)} PREREQUISITE VIOLATIONS`,
    evaluation && `${asPercent(evaluation.ours.gapCoverage)} SKILL GAP CLOSED`,
    evaluation && `${asScore(evaluation.ours.ndcg)} AGREEMENT WITH EXPERT`,
    `${corpus.resources} RESOURCES SURVEYED`,
    corpus.scenarios > 0 && `${corpus.scenarios} EXPERT-LABELLED ROUTES`,
    tests && `${tests} TESTS PASSING`,
  ].filter((entry): entry is string => Boolean(entry));

  const metrics = evaluation
    ? [
        {
          value: asPercent(evaluation.ours.prereqViolationRate),
          against: asPercent(evaluation.baseline.prereqViolationRate),
          label: "PREREQUISITE VIOLATIONS",
          ink: RED_INK,
        },
        {
          value: asPercent(evaluation.ours.gapCoverage),
          against: asPercent(evaluation.baseline.gapCoverage),
          label: "SKILL GAP CLOSED",
          ink: BLUE,
        },
        {
          value: asScore(evaluation.ours.ndcg),
          against: asScore(evaluation.baseline.ndcg),
          label: "AGREEMENT WITH EXPERT",
          ink: GREEN,
        },
        {
          value: asScore(evaluation.ours.kendallTau),
          against: asScore(evaluation.baseline.kendallTau),
          label: "ORDERING CORRELATION",
          ink: AMBER_INK,
        },
      ]
    : [];

  return (
    <div
      className="relative min-h-screen"
      style={{
        background: PAPER,
        color: INK,
        fontFamily: "var(--font-display), system-ui, sans-serif",
      }}
    >
      <PaperGrain />

      <header
        style={{ background: INK, color: PAPER }}
        className="relative z-10"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <span className="text-[0.95rem] font-extrabold tracking-[0.3em]">
            WAYPOINT
          </span>
          <span
            className="px-2 py-0.5 font-mono text-[0.7rem] font-bold tracking-[0.18em]"
            style={{ background: RED_INK, color: PAPER }}
          >
            LINE 01 · DATA
          </span>
          <nav className="ml-auto flex flex-wrap gap-x-5 gap-y-1 text-[0.7rem] font-semibold tracking-[0.18em]">
            <Link href="/eval" className="hover:opacity-70">
              EVIDENCE
            </Link>
            <Link href="/dashboard/demo" className="hover:opacity-70">
              DASHBOARD
            </Link>
            <Link href="/start">PLAN A ROUTE →</Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-6 pt-14 pb-16">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="wp-rise">
              <p
                className="mb-6 font-mono text-[0.7rem] font-bold tracking-[0.28em]"
                style={{ color: RED_INK }}
              >
                LEARNING PATH PLANNER · PROTOTYPE ROUND
              </p>
              <h1
                className="text-[clamp(2.5rem,6.2vw,4.6rem)] leading-[0.93] font-extrabold tracking-[-0.03em]"
                style={{ textWrap: "balance" }}
              >
                EVERY COURSE
                <br />
                IS A STATION.
                <br />
                <span style={{ color: RED }}>LEARNING IS</span>
                <br />
                <span style={{ color: RED }}>THE LINE</span> BETWEEN.
              </h1>
              <p className="mt-7 max-w-lg text-[1.05rem] leading-relaxed">
                Catalogue search hands you a pile of stations and wishes you
                luck. Waypoint builds the line — working out which skills stand
                between you and where you want to be, then ordering the journey
                so you never arrive somewhere you are not ready for.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/start"
                  className="wp-press px-6 py-3 text-sm font-bold tracking-[0.16em]"
                  style={{ background: INK, color: PAPER }}
                >
                  PLAN MY ROUTE
                </Link>
                <Link
                  href="/eval"
                  className="wp-press border-[3px] px-6 py-3 text-sm font-bold tracking-[0.16em]"
                  style={{ borderColor: INK }}
                >
                  SEE THE EVIDENCE
                </Link>
              </div>
            </div>

            <div className="wp-rise" style={{ animationDelay: "0.15s" }}>
              <NetworkMap />
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[0.72rem] font-semibold tracking-[0.12em]">
                {[
                  { c: RED, l: "DATA ANALYSIS" },
                  { c: BLUE, l: "WEB DEVELOPMENT" },
                  { c: GREEN, l: "FOUNDATIONS" },
                ].map((line) => (
                  <li key={line.l} className="flex items-center gap-2">
                    <span
                      style={{ width: 22, height: 7, background: line.c }}
                    />
                    {line.l}
                  </li>
                ))}
                <li className="flex items-center gap-2">
                  <span
                    style={{
                      width: 13,
                      height: 13,
                      border: `3px solid ${INK}`,
                      transform: "rotate(45deg)",
                    }}
                  />
                  INTERCHANGE
                </li>
              </ul>
            </div>
          </div>
        </section>

        <div
          className="overflow-hidden border-y-[3px] py-3"
          style={{ borderColor: INK, background: PAPER }}
          aria-hidden="true"
        >
          <div className="wp-ticker flex w-max gap-10 whitespace-nowrap">
            {[...ticker, ...ticker].map((item, i) => (
              <span
                key={i}
                className="font-mono text-[0.78rem] font-bold tracking-[0.2em]"
              >
                <span style={{ color: RED_INK }}>◆</span> {item}
              </span>
            ))}
          </div>
        </div>
        <p className="sr-only">
          {ticker.join(". ")}. Every figure is read from the live corpus and the
          evaluation harness output.
        </p>

        <section
          className="relative overflow-hidden py-20"
          style={{ background: INK, color: PAPER }}
        >
          <Halftone />
          <div className="relative mx-auto max-w-6xl px-6">
            <RouteBoard />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="mb-3 text-[clamp(1.8rem,4vw,3rem)] leading-none font-extrabold tracking-[-0.02em]">
            HOW THE LINE IS BUILT
          </h2>
          <p className="mb-12 max-w-2xl text-base leading-relaxed">
            Four mechanisms, none of them a chat wrapper. The language model
            reads your goal and phrases the reasoning; it never chooses a
            course, never decides an order, and never sees the catalogue.
          </p>

          <div
            className="grid gap-px sm:grid-cols-2 lg:grid-cols-4"
            style={{ background: INK }}
          >
            {[
              {
                n: "01",
                ink: RED_INK,
                title: "SURVEY",
                body: "You describe the destination in your own words. It compiles into concrete skills and target levels against a canonical graph — never invented, only selected.",
              },
              {
                n: "02",
                ink: BLUE,
                title: "MEASURE",
                body: "Your position minus the destination gives a gap, expanded across every prerequisite. Retrieval matches that gap, not your sentence, against what each resource teaches.",
              },
              {
                n: "03",
                ink: GREEN,
                title: "PLOT",
                body: "Beam search over the prerequisite graph. Only resources you are ready for are ever considered, so an impossible ordering cannot be produced — not filtered out, never generated.",
              },
              {
                n: "04",
                ink: AMBER_INK,
                title: "RE-ROUTE",
                body: "Tell it a course did not work. Mastery moves, the line is re-plotted around it, and the diff names exactly what changed and why it changed.",
              },
            ].map((step) => (
              <article
                key={step.n}
                className="wp-card p-7"
                style={{ background: PAPER }}
              >
                <div className="mb-5 flex items-center gap-3">
                  <span
                    className="px-2 py-1 font-mono text-[0.72rem] font-extrabold"
                    style={{ background: step.ink, color: PAPER }}
                  >
                    {step.n}
                  </span>
                  <h3 className="text-lg font-extrabold tracking-[0.08em]">
                    {step.title}
                  </h3>
                </div>
                <p className="font-mono text-[0.86rem] leading-relaxed">
                  {step.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {metrics.length > 0 && evaluation && (
          <section className="border-t-4 py-20" style={{ borderColor: INK }}>
            <div className="mx-auto max-w-6xl px-6">
              <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
                <h2 className="text-[clamp(1.8rem,4vw,3rem)] leading-none font-extrabold tracking-[-0.02em]">
                  MEASURED, NOT CLAIMED
                </h2>
                <p className="max-w-md text-sm leading-relaxed">
                  Scored against {evaluation.scenarios} learning paths a human
                  expert wrote by hand, alongside the semantic search this is
                  meant to beat. Both saw the same corpus of {corpus.resources}{" "}
                  resources and the same embeddings.
                </p>
              </div>

              <div
                className="grid gap-px md:grid-cols-2 lg:grid-cols-4"
                style={{ background: INK }}
              >
                {metrics.map((stat) => (
                  <div
                    key={stat.label}
                    className="wp-card p-7"
                    style={{ background: PAPER }}
                  >
                    <p
                      className="font-mono text-[clamp(2.4rem,5vw,3.4rem)] leading-none font-extrabold tracking-[-0.03em] tabular-nums"
                      style={{ color: stat.ink }}
                    >
                      {stat.value}
                    </p>
                    <p className="mt-3 text-[0.7rem] font-bold tracking-[0.16em]">
                      {stat.label}
                    </p>
                    <p
                      className="mt-1 font-mono text-[0.75rem] tabular-nums"
                      style={{ opacity: 0.62 }}
                    >
                      similarity search: {stat.against}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-6 max-w-3xl text-sm leading-relaxed">
                The last figure is the one worth staring at. A correlation of{" "}
                {asScore(evaluation.baseline.kendallTau)} means the
                baseline&apos;s ordering is indistinguishable from shuffling the
                results. It finds relevant courses and then hands them to you in
                an order nobody could learn from.
              </p>
              <p
                className="mt-3 font-mono text-[0.72rem]"
                style={{ opacity: 0.72 }}
              >
                Generated{" "}
                {new Date(evaluation.generatedAt).toISOString().slice(0, 10)} by{" "}
                <code>npm run eval</code> · {evaluation.mode} baseline · corpus
                read from {corpus.source}
              </p>
            </div>
          </section>
        )}
      </main>

      <footer
        style={{ background: INK, color: PAPER }}
        className="relative z-10 py-16"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-8 px-6">
          <div>
            <p className="text-[clamp(1.6rem,3.5vw,2.6rem)] leading-none font-extrabold tracking-[-0.02em]">
              MIND THE GAP.
            </p>
            <p
              className="mt-3 max-w-md font-mono text-sm tabular-nums"
              style={{ opacity: 0.72 }}
            >
              {corpus.skills} skills · {corpus.resources} resources
              {corpus.scenarios > 0 &&
                ` · ${corpus.scenarios} expert-labelled routes`}{" "}
              · built for the HCL prototype round
            </p>
          </div>
          <Link
            href="/start"
            className="wp-press px-7 py-3.5 text-sm font-bold tracking-[0.16em]"
            style={{ background: RED_INK, color: PAPER }}
          >
            PLAN MY ROUTE →
          </Link>
        </div>
      </footer>
    </div>
  );
}

/** Printed-paper tooth. Cheaper and more honest than a stock background image. */
function PaperGrain() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-[0.22] mix-blend-multiply"
    >
      <filter id="wp-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.82"
          numOctaves="4"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#wp-grain)" />
    </svg>
  );
}

/** Halftone dots on the dark panel — offset-printing texture, not a gradient. */
function Halftone() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]"
    >
      <pattern
        id="wp-dots"
        width="14"
        height="14"
        patternUnits="userSpaceOnUse"
      >
        <circle cx="2" cy="2" r="1.5" fill="#F4F3EF" />
      </pattern>
      <rect width="100%" height="100%" fill="url(#wp-dots)" />
    </svg>
  );
}
