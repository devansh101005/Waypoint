"use client";

import { useEffect, useState } from "react";
import { AskPanel } from "@/components/ask-panel";
import { ReadingStrip, TransitBar } from "@/components/transit/chrome";
import { TransitRoute, type RouteStop } from "@/components/transit/route";
import { INK, LINE, LINE_INK, PAPER } from "@/components/transit/theme";
import { rememberRoute } from "@/lib/learner-memory";
import type { PathDiff } from "@/lib/types";

/**
 * Planning a route by hand.
 *
 * The conversational intake is the front door; this exists because the language
 * gateway is slow and occasionally down, and a demo that cannot show the
 * planner without it has a single point of failure. Same planner, same route
 * rendering, no model in the loop.
 */

interface CatalogueSkill {
  id: string;
  name: string;
  domain: string;
  teachable: boolean;
  /** Highest level any resource takes this skill to. */
  maxLevel: number;
  /** How many prerequisites sit behind it. */
  depth: number;
}

interface GapEntry {
  skillId: string;
  name: string;
  currentLevel: number;
  targetLevel: number;
  isGoal: boolean;
}

interface PathResponse {
  pathId: string;
  learnerId: string;
  complete: boolean;
  totalHours: number;
  items: RouteStop[];
  gap: GapEntry[];
  diff: PathDiff | null;
  detail?: string;
}

/** Working-professional level: what "employable" means in the skill scale. */
const TARGET_LEVEL = 4;

export default function PlanPage() {
  const [catalogue, setCatalogue] = useState<CatalogueSkill[]>([]);
  const [goal, setGoal] = useState("");
  const [known, setKnown] = useState<string[]>([]);
  const [result, setResult] = useState<PathResponse | null>(null);
  const [planning, setPlanning] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/demo")
      .then((r) => r.json())
      .then((data) => {
        const skills: CatalogueSkill[] = data.skills ?? [];
        setCatalogue(skills);
        /**
         * Open on a destination the corpus can actually deliver. Defaulting to
         * whatever sorted first offered a skill whose best resource stops at
         * level 2, so the first thing anyone saw was a route that could not
         * reach its own goal — honest, but a poor introduction.
         */
        const reachable = skills
          .filter((s) => s.teachable && s.maxLevel >= TARGET_LEVEL)
          .sort((a, b) => b.depth - a.depth)[0];
        const fallback = skills.find((s) => s.teachable);
        const chosen = reachable ?? fallback;
        if (chosen) setGoal(chosen.id);
      })
      .catch(() => setMessage("Could not load the skill catalogue."));
  }, []);

  async function plot() {
    if (!goal) return;
    setPlanning(true);
    setMessage("");
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalSkills: [{ skillId: goal, level: TARGET_LEVEL }],
          statedSkills: known.map((skillId) => ({ skillId, level: 3 })),
          goalText: `I want to learn ${catalogue.find((s) => s.id === goal)?.name ?? goal}`,
        }),
      });
      const data: PathResponse = await response.json();
      if (!response.ok) {
        setMessage(data.detail ?? "Planning failed.");
        return;
      }
      setResult(data);
      // Hold on to the id so this route can be found again after the tab closes.
      rememberRoute(
        data.learnerId,
        catalogue.find((s) => s.id === goal)?.name ?? "Your route",
      );
    } catch {
      setMessage("Could not reach the planner.");
    } finally {
      setPlanning(false);
    }
  }

  async function sendFeedback(resourceId: string, event: "done" | "struggled") {
    if (!result) return;
    setBusy(resourceId);
    try {
      const response = await fetch("/api/paths/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerId: result.learnerId,
          pathId: result.pathId,
          resourceId,
          event,
        }),
      });
      const data: PathResponse = await response.json();
      if (!response.ok) {
        setMessage(data.detail ?? "Could not update your route.");
        return;
      }
      setResult(data);
    } finally {
      setBusy(null);
    }
  }

  const changed = new Set(result?.diff?.added.map((a) => a.resourceId) ?? []);
  const destinations = catalogue.filter((s) => s.teachable);

  return (
    <div className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <TransitBar line="PLOT BY HAND" />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="wp-display text-[clamp(2rem,5vw,3.2rem)] leading-[0.95] font-extrabold tracking-[-0.02em]">
          PLOT A ROUTE
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed">
          Choose a destination and mark the stations you have already passed.
          The planner works out what stands between the two and orders it so
          nothing arrives before you are ready for it.
        </p>

        <section
          aria-labelledby="setup"
          className="mt-8 border-[3px] p-5"
          style={{ borderColor: INK }}
        >
          <h2 id="setup" className="sr-only">
            Choose your destination
          </h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="goal"
                className="mb-2 block font-mono text-[0.68rem] font-bold tracking-[0.18em]"
              >
                DESTINATION
              </label>
              <select
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full border-2 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  borderColor: INK,
                  background: PAPER,
                  outlineColor: LINE.data,
                }}
              >
                {destinations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.domain}
                    {s.maxLevel < TARGET_LEVEL
                      ? ` · tops out at level ${s.maxLevel}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="min-w-0">
              <legend className="mb-2 font-mono text-[0.68rem] font-bold tracking-[0.18em]">
                STATIONS ALREADY PASSED
              </legend>
              {/*
                Checkboxes rather than a multi-select. In a native
                <select multiple> a plain click on an already-chosen row clears
                every other choice instead of unticking that one, and getting a
                second item requires knowing to hold ctrl. Both behaviours were
                reported as bugs, which is the correct reaction to them.
              */}
              <div
                className="h-40 overflow-y-auto border-2 px-3 py-2"
                style={{ borderColor: INK, background: PAPER }}
              >
                {catalogue.map((s) => {
                  const on = known.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2.5 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setKnown((current) =>
                            on
                              ? current.filter((id) => id !== s.id)
                              : [...current, s.id],
                          )
                        }
                        className="size-4 shrink-0 accent-current"
                        style={{ accentColor: LINE_INK.data }}
                      />
                      <span className="min-w-0">{s.name}</span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 font-mono text-[0.68rem]">
                <span className="opacity-70">
                  {known.length === 0
                    ? "LEAVE EMPTY IF STARTING FRESH"
                    : `${known.length} SELECTED`}
                </span>
                {known.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setKnown([])}
                    className="underline underline-offset-4 hover:opacity-70"
                  >
                    CLEAR ALL
                  </button>
                )}
              </p>
            </fieldset>
          </div>

          <button
            type="button"
            onClick={plot}
            disabled={planning || !goal}
            className="wp-press mt-5 px-6 py-3 text-sm font-bold tracking-[0.16em] disabled:opacity-50"
            style={{ background: INK, color: PAPER }}
          >
            {planning ? (
              <>
                PLOTTING ROUTE
                <span className="wp-ellipsis" />
              </>
            ) : (
              "PLOT MY ROUTE"
            )}
          </button>

          {message && (
            <p
              role="alert"
              className="mt-3 text-sm"
              style={{ color: LINE_INK.data }}
            >
              {message}
            </p>
          )}
        </section>

        {result && (
          <>
            <section aria-labelledby="summary" className="mt-10">
              <h2 id="summary" className="sr-only">
                Route summary
              </h2>
              <ReadingStrip
                readings={[
                  { label: "STOPS", value: String(result.items.length) },
                  {
                    label: "HOURS",
                    value: String(result.totalHours),
                    accent: true,
                  },
                  {
                    label: "SKILLS TO CLOSE",
                    value: String(result.gap.length),
                  },
                  {
                    label: "REACHES GOAL",
                    value: result.complete ? "YES" : "PARTLY",
                  },
                ]}
              />
            </section>

            {result.diff &&
              result.diff.summary !== "Your path is unchanged." && (
                <p
                  aria-live="polite"
                  className="mt-6 py-2 pl-4 text-sm"
                  style={{ borderLeft: `4px solid ${LINE.accent}` }}
                >
                  <span
                    className="block font-mono text-[0.66rem] font-bold tracking-[0.18em]"
                    style={{ color: LINE_INK.accent }}
                  >
                    ROUTE UPDATED
                  </span>
                  <span className="mt-1 block">{result.diff.summary}</span>
                </p>
              )}

            <section aria-labelledby="route" className="mt-10">
              <h2
                id="route"
                className="wp-display mb-6 text-[clamp(1.5rem,3.5vw,2.2rem)] leading-none font-extrabold tracking-[-0.02em]"
              >
                YOUR ROUTE
              </h2>
              <TransitRoute
                stops={result.items}
                pathId={result.pathId}
                onFeedback={sendFeedback}
                busyResourceId={busy}
                changedResourceIds={changed}
              />
            </section>

            <AskPanel pathId={result.pathId} />

            {result.gap.length > 0 && (
              <section aria-labelledby="gap" className="mt-12">
                <h2
                  id="gap"
                  className="wp-display mb-5 text-[clamp(1.3rem,3vw,1.9rem)] font-extrabold tracking-[-0.01em]"
                >
                  WHAT STANDS BETWEEN YOU AND THE DESTINATION
                </h2>
                <ul className="grid gap-x-8 sm:grid-cols-2">
                  {result.gap.map((g) => (
                    <li
                      key={g.skillId}
                      className="flex items-baseline justify-between gap-3 border-b py-2 text-sm"
                      style={{ borderColor: "rgba(22,22,26,0.15)" }}
                    >
                      <span className={g.isGoal ? "font-semibold" : undefined}>
                        {g.name}
                        {g.isGoal && (
                          <span
                            className="ml-2 font-mono text-[0.6rem] tracking-[0.14em]"
                            style={{ color: LINE_INK.data }}
                          >
                            GOAL
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-xs tabular-nums whitespace-nowrap opacity-70">
                        {g.currentLevel} ▸ {g.targetLevel}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
