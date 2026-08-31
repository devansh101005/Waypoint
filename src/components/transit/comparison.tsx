"use client";

import { useState } from "react";
import { INK, LINE, LINE_INK, PAPER } from "./theme";
import type { RouteStep, SideBySide } from "@/lib/types";

/**
 * The same learner, routed two ways.
 *
 * The aggregate table says the similarity baseline puts a learner in front of
 * material they are not ready for about half the time. That is the strongest
 * claim on the page and it arrives as a percentage, which a reader has to take
 * on trust. Here the two routes stand next to each other with every unmet
 * prerequisite named on the step that needs it, so the claim can be checked
 * rather than believed.
 *
 * Both columns are real output — same corpus, same embeddings, same learner.
 */

interface ComparisonProps {
  comparisons: Array<{ id: string; persona: string } & SideBySide>;
}

export function RouteComparison({ comparisons }: ComparisonProps) {
  const [index, setIndex] = useState(0);
  const chosen = comparisons[index];
  if (!chosen) return null;

  const oursBad = chosen.ours.filter((s) => s.missingPrereqs.length > 0).length;
  const baseBad = chosen.baseline.filter(
    (s) => s.missingPrereqs.length > 0,
  ).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-full">
          <label
            htmlFor="comparison-learner"
            className="mb-2 block font-mono text-[0.66rem] font-bold tracking-[0.18em]"
            style={{ opacity: 0.7 }}
          >
            LEARNER
          </label>
          <select
            id="comparison-learner"
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            /* A select sizes itself to its longest option and will happily
               exceed a narrow viewport; these keep it inside one. */
            className="w-full max-w-full min-w-0 truncate border-2 px-3 py-2 font-mono text-sm"
            style={{ borderColor: INK, background: PAPER, color: INK }}
          >
            {comparisons.map((c, i) => (
              <option key={c.id} value={i}>
                {c.persona}
              </option>
            ))}
          </select>
        </div>
        <p
          className="max-w-md text-sm leading-relaxed"
          style={{ opacity: 0.8 }}
        >
          &ldquo;{chosen.goal}&rdquo;
          <span className="mt-1 block font-mono text-[0.72rem]">
            ALREADY KNOWS:{" "}
            {chosen.knownSkills.length > 0
              ? chosen.knownSkills
                  .map((k) => `${k.name} L${k.level}`)
                  .join(" · ")
              : "NOTHING RELEVANT"}
          </span>
        </p>
      </div>

      <div className="grid gap-px lg:grid-cols-2" style={{ background: INK }}>
        <Column
          title="WAYPOINT"
          subtitle="Planned over the prerequisite graph"
          steps={chosen.ours}
          notReady={oursBad}
        />
        <Column
          title="SIMILARITY SEARCH"
          subtitle="Ranked by closeness to the goal text"
          steps={chosen.baseline}
          notReady={baseBad}
        />
      </div>

      <p className="mt-4 text-sm leading-relaxed">
        Both columns are real output over the same catalogue and the same
        embeddings. The difference is not the search — it is that one of them
        knows what has to come first.
      </p>
    </div>
  );
}

function Column({
  title,
  subtitle,
  steps,
  notReady,
}: {
  title: string;
  subtitle: string;
  steps: RouteStep[];
  notReady: number;
}) {
  const clean = notReady === 0;
  return (
    <section
      aria-label={title}
      className="p-5"
      style={{ background: PAPER, color: INK }}
    >
      <header
        className="mb-4 border-b-4 pb-3"
        style={{ borderColor: clean ? LINE.foundations : LINE_INK.data }}
      >
        <h3 className="wp-display text-xl font-extrabold">{title}</h3>
        <p className="font-mono text-[0.7rem]" style={{ opacity: 0.7 }}>
          {subtitle}
        </p>
        <p
          className="mt-2 font-mono text-[0.72rem] font-bold tracking-[0.1em]"
          style={{ color: clean ? LINE.foundations : LINE_INK.data }}
        >
          {clean
            ? `ALL ${steps.length} STEPS READY`
            : `${notReady} OF ${steps.length} STEPS NOT READY`}
        </p>
      </header>

      <ol className="space-y-3">
        {steps.map((step) => {
          const blocked = step.missingPrereqs.length > 0;
          return (
            <li
              key={`${step.position}-${step.id}`}
              className="grid grid-cols-[1.75rem_1fr] gap-3"
              style={{
                // The mark, not the colour, is what carries this: a red tint
                // alone would vanish in a photographed projection and would be
                // invisible to a colour-blind reader.
                borderLeft: blocked ? `4px solid ${LINE_INK.data}` : undefined,
                paddingLeft: blocked ? "0.6rem" : undefined,
                marginLeft: blocked ? "-1rem" : undefined,
              }}
            >
              <span
                className="font-mono text-[0.72rem] tabular-nums"
                style={{ opacity: 0.6 }}
              >
                {String(step.position).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-snug font-semibold">
                  {step.title}
                </p>
                <p
                  className="font-mono text-[0.68rem] tabular-nums"
                  style={{ opacity: 0.65 }}
                >
                  {step.provider || "—"} · {step.estHours}h
                </p>
                {blocked && (
                  <p
                    className="mt-1 font-mono text-[0.68rem] font-bold"
                    style={{ color: LINE_INK.data }}
                  >
                    NOT READY — needs {step.missingPrereqs.join(", ")}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
