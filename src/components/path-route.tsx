"use client";

import { useState } from "react";
import type { Reasons } from "@/lib/types";

/**
 * The route view — the signature element.
 *
 * A path is a sequence, so it is drawn as one: a continuous amber line down the
 * page with a waypoint at every step and a diamond at every milestone. The line
 * is solid behind the learner and hairline-dashed ahead of them, so "how far in
 * am I" is answerable at a glance rather than by reading numbers.
 */

export interface RouteItem {
  position: number;
  resource: {
    id: string;
    title: string;
    url: string;
    provider: string;
    type: string;
    difficulty: number;
    estHours: number;
  };
  milestone: string | null;
  reasons: Reasons;
}

interface PathRouteProps {
  items: RouteItem[];
  /** Enables the "why this step" prose, which needs a saved path to explain. */
  pathId?: string | null;
  /** Steps before this position are treated as walked. */
  progressPosition?: number;
  onFeedback?: (resourceId: string, event: "done" | "struggled") => void;
  busyResourceId?: string | null;
  changedResourceIds?: Set<string>;
}

export function PathRoute({
  items,
  pathId,
  progressPosition = 1,
  onFeedback,
  busyResourceId,
  changedResourceIds,
}: PathRouteProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [prose, setProse] = useState<Record<string, string>>({});
  const [phrasing, setPhrasing] = useState<string | null>(null);

  /**
   * Fetch the phrased explanation the first time a step is opened. The
   * structured reasons are already on screen by then, so a slow gateway delays
   * the prose rather than the answer.
   */
  async function open(resourceId: string) {
    const isOpen = openId === resourceId;
    setOpenId(isOpen ? null : resourceId);
    if (isOpen || !pathId || prose[resourceId]) return;

    setPhrasing(resourceId);
    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathId, resourceId }),
      });
      if (response.ok) {
        const data = await response.json();
        setProse((current) => ({ ...current, [resourceId]: data.text }));
      }
    } catch {
      /* the structured reasons below are the answer; prose is a bonus */
    } finally {
      setPhrasing(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="border-hairline text-ink-muted rounded-md border border-dashed p-8 text-center text-sm">
        No route yet. Choose a destination to plan one.
      </p>
    );
  }

  return (
    <ol className="relative">
      {items.map((item, index) => {
        const walked = item.position < progressPosition;
        const isLast = index === items.length - 1;
        const isOpen = openId === item.resource.id;
        const changed = changedResourceIds?.has(item.resource.id) ?? false;

        return (
          <li
            key={item.resource.id}
            className="relative grid grid-cols-[2.5rem_1fr] gap-x-4 pb-8"
          >
            {/* the route line */}
            {!isLast && (
              <span
                aria-hidden="true"
                className={`absolute top-9 bottom-0 left-[1.25rem] -translate-x-1/2 ${
                  walked ? "bg-route w-[3px]" : "w-[2px]"
                }`}
                style={
                  walked
                    ? undefined
                    : {
                        backgroundImage:
                          "repeating-linear-gradient(to bottom, var(--route) 0 7px, transparent 7px 14px)",
                        opacity: 0.45,
                      }
                }
              />
            )}

            {/* waypoint marker */}
            <span
              aria-hidden="true"
              className={`relative z-10 flex size-10 items-center justify-center font-[family-name:var(--font-display)] text-sm font-semibold ${
                item.milestone
                  ? "text-route-ink rotate-45 border-2 border-current"
                  : walked
                    ? "bg-route text-paper rounded-full"
                    : "border-hairline text-ink-muted bg-paper rounded-full border"
              }`}
            >
              <span className={item.milestone ? "-rotate-45" : undefined}>
                {item.position}
              </span>
            </span>

            <div className="min-w-0 pt-1">
              {item.milestone && (
                <p className="text-route-ink mb-1 text-xs font-semibold tracking-[0.18em] uppercase">
                  {item.milestone.replace(/^Milestone:\s*/i, "Milestone · ")}
                </p>
              )}

              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-[family-name:var(--font-display)] text-lg leading-tight font-semibold">
                  {item.resource.title}
                </h3>
                {changed && (
                  <span className="border-route text-route-ink rounded-full border px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase">
                    new
                  </span>
                )}
              </div>

              <p className="text-ink-muted mt-0.5 font-mono text-xs">
                {item.resource.provider || item.resource.type} ·{" "}
                {item.resource.estHours}h · difficulty{" "}
                {item.resource.difficulty}/5
              </p>

              <p className="mt-2 text-sm">{coverSentence(item.reasons)}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void open(item.resource.id)}
                  aria-expanded={isOpen}
                  className="border-hairline hover:border-route focus-visible:ring-ring rounded-full border px-3 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
                >
                  {isOpen ? "Hide reasoning" : "Why this step?"}
                </button>

                {onFeedback && (
                  <>
                    <button
                      type="button"
                      disabled={busyResourceId === item.resource.id}
                      onClick={() => onFeedback(item.resource.id, "done")}
                      className="border-hairline hover:border-route focus-visible:ring-ring rounded-full border px-3 py-1 text-xs disabled:opacity-50 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      I finished this
                    </button>
                    <button
                      type="button"
                      disabled={busyResourceId === item.resource.id}
                      onClick={() => onFeedback(item.resource.id, "struggled")}
                      className="border-hairline hover:border-route focus-visible:ring-ring rounded-full border px-3 py-1 text-xs disabled:opacity-50 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      I struggled here
                    </button>
                  </>
                )}

                <a
                  href={item.resource.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-ink-muted hover:text-route-ink focus-visible:ring-ring rounded-full px-1 text-xs underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                >
                  Open resource
                </a>
              </div>

              {isOpen && (
                <>
                  {prose[item.resource.id] ? (
                    <p className="border-route mt-3 border-l-2 py-1 pl-4 text-sm">
                      {prose[item.resource.id]}
                    </p>
                  ) : phrasing === item.resource.id ? (
                    <p className="text-ink-muted mt-3 pl-4 text-sm italic">
                      Writing this up…
                    </p>
                  ) : null}
                  <Reasoning reasons={item.reasons} />
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Reasoning({ reasons }: { reasons: Reasons }) {
  return (
    <dl className="border-hairline mt-3 space-y-2 border-l pl-4 text-sm">
      {reasons.coversGapSkills.length > 0 && (
        <Row label="Closes">
          {reasons.coversGapSkills
            .map((c) => `${c.name} ${c.fromLevel} → ${c.toLevel}`)
            .join(" · ")}
        </Row>
      )}
      {reasons.unlockedBy.length > 0 && (
        <Row label="Needs first">
          {[...new Set(reasons.unlockedBy.map((u) => u.title))].join(" · ")}
        </Row>
      )}
      {reasons.unlocks.length > 0 && (
        <Row label="Opens up">
          {reasons.unlocks.map((u) => u.name).join(" · ")}
        </Row>
      )}
      <Row label="Fit">
        difficulty {reasons.difficultyFit.resourceDifficulty}/5 against your
        level {reasons.difficultyFit.learnerLevel} —{" "}
        {reasons.difficultyFit.verdict}
      </Row>
      <Row label="Cost">{reasons.estHours} hours</Row>
    </dl>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3">
      <dt className="text-ink-muted text-xs tracking-wide uppercase">
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function coverSentence(reasons: Reasons): string {
  const covers = reasons.coversGapSkills;
  if (covers.length === 0) return "Consolidates what you have already covered.";
  const names = covers.map((c) => c.name);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `Builds ${list}.`;
}
