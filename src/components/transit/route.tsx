"use client";

import { useEffect, useRef, useState } from "react";
import { INK, LINE, LINE_INK, ON_INK, PAPER } from "./theme";
import type { Reasons } from "@/lib/types";

/**
 * The route, drawn as a transit line. One implementation, used by the landing
 * page, the planner, the conversation and the dashboard — porting the identity
 * into each screen separately is how they end up disagreeing.
 *
 * The line draws itself station by station because that is what a transit line
 * does. Motion is never load-bearing: every stop renders in its final state and
 * the animation is added on top, so a fast scroller, a printed page, a
 * screenshot and a reduced-motion reader all see the whole route.
 */

export interface RouteStop {
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

interface TransitRouteProps {
  stops: RouteStop[];
  /** Stops before this position are behind the learner. */
  progressPosition?: number;
  /** Rendered on the ink panel rather than on paper. */
  onInk?: boolean;
  pathId?: string | null;
  onFeedback?: (resourceId: string, event: "done" | "struggled") => void;
  busyResourceId?: string | null;
  /** Stops the last replan introduced, held highlighted for a moment. */
  changedResourceIds?: Set<string>;
  /** Stops on their way out — rendered fading, and no longer interactive. */
  leavingResourceIds?: Set<string>;
  /** The <ol>, so a parent can measure stop positions across a re-plot. */
  listRef?: React.RefObject<HTMLOListElement | null>;
}

export function TransitRoute({
  stops,
  progressPosition = 1,
  onInk = false,
  pathId,
  onFeedback,
  busyResourceId,
  changedResourceIds,
  leavingResourceIds,
  listRef: externalListRef,
}: TransitRouteProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [prose, setProse] = useState<Record<string, string>>({});
  const [phrasing, setPhrasing] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);
  const ownListRef = useRef<HTMLOListElement>(null);
  const listRef = externalListRef ?? ownListRef;

  const ink = onInk ? PAPER : INK;
  const line = onInk ? ON_INK.data : LINE.data;
  const accent = onInk ? ON_INK.accent : LINE_INK.accent;
  const muted = onInk ? ON_INK.muted : "rgba(22,22,26,0.66)";
  const hairline = onInk ? ON_INK.hairline : "rgba(22,22,26,0.18)";

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setDrawn(true),
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  async function toggle(resourceId: string) {
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
      /* the structured reasoning below is the answer; prose is a bonus */
    } finally {
      setPhrasing(null);
    }
  }

  if (stops.length === 0) {
    return (
      <p
        className="border border-dashed p-8 text-center text-sm"
        style={{ borderColor: hairline, color: muted }}
      >
        No route yet.
      </p>
    );
  }

  return (
    <>
      {/*
        No parallel screen-reader copy: the visible list is already an ordered
        list of stops carrying titles, hours, difficulty and skill deltas as
        text. Hiding it behind aria-hidden and duplicating it put focusable
        buttons inside hidden content, which is worse for a keyboard user than
        having no duplicate at all.
      */}
      <ol ref={listRef} className="relative">
        {stops.map((stop, index) => {
          const walked = stop.position < progressPosition;
          const current = stop.position === progressPosition;
          const last = index === stops.length - 1;
          const isOpen = openId === stop.resource.id;
          const changed = changedResourceIds?.has(stop.resource.id) ?? false;
          const leaving = leavingResourceIds?.has(stop.resource.id) ?? false;

          return (
            <li
              key={stop.resource.id}
              data-stop-id={stop.resource.id}
              className={leaving ? "wp-leaving" : drawn ? "wp-stop" : undefined}
              style={{
                animationDelay: leaving ? undefined : `${index * 90}ms`,
              }}
              /* inert alone: it drops the stop from the a11y tree AND from the
                 tab order. aria-hidden on its own would leave the buttons
                 inside focusable but unreadable, which is the worse half. */
              inert={leaving}
            >
              <div className="grid grid-cols-[3.25rem_1fr] gap-x-5 pb-8">
                <div className="relative flex justify-center">
                  {!last && (
                    <span
                      className={drawn ? "wp-segment" : undefined}
                      style={{
                        position: "absolute",
                        top: "1.75rem",
                        bottom: "-2rem",
                        width: 9,
                        background: walked ? line : "transparent",
                        backgroundImage: walked
                          ? undefined
                          : `repeating-linear-gradient(to bottom, ${line} 0 8px, transparent 8px 16px)`,
                        opacity: walked ? 1 : 0.5,
                        transformOrigin: "top",
                        animationDelay: `${index * 90 + 60}ms`,
                      }}
                    />
                  )}

                  <Marker
                    milestone={Boolean(stop.milestone)}
                    walked={walked}
                    current={current}
                    ink={ink}
                    line={line}
                    paper={onInk ? INK : PAPER}
                    delay={index * 90}
                    animate={drawn}
                  />
                </div>

                <div className="min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3
                      className="wp-display text-[clamp(1.05rem,2vw,1.45rem)] font-bold tracking-[0.02em] uppercase"
                      style={{ color: ink }}
                    >
                      {stop.resource.title}
                    </h3>
                    <span
                      className="font-mono text-sm font-bold tabular-nums"
                      style={{ color: accent }}
                    >
                      {stop.resource.estHours}h
                    </span>
                    {changed && (
                      <span
                        className="px-2 py-0.5 font-mono text-[0.6rem] font-bold tracking-[0.16em]"
                        style={{ background: LINE.accent, color: INK }}
                      >
                        NEW
                      </span>
                    )}
                    {stop.milestone && (
                      <span
                        className="px-2 py-0.5 font-mono text-[0.6rem] font-bold tracking-[0.16em]"
                        style={{
                          background: onInk ? PAPER : INK,
                          color: onInk ? LINE_INK.data : PAPER,
                        }}
                      >
                        INTERCHANGE
                      </span>
                    )}
                  </div>

                  <p
                    className="mt-1 font-mono text-[0.75rem] tabular-nums"
                    style={{ color: muted }}
                  >
                    {stop.resource.provider || stop.resource.type} · difficulty{" "}
                    {stop.resource.difficulty}/5
                    {stop.reasons.coversGapSkills.length > 0 &&
                      ` · ${stop.reasons.coversGapSkills
                        .map((c) => `${c.name} ${c.fromLevel}▸${c.toLevel}`)
                        .join(" · ")}`}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Chip
                      onClick={() => void toggle(stop.resource.id)}
                      ink={ink}
                      pressed={isOpen}
                    >
                      {isOpen ? "HIDE REASONING" : "WHY THIS STEP?"}
                    </Chip>

                    {onFeedback && (
                      <>
                        <Chip
                          onClick={() => onFeedback(stop.resource.id, "done")}
                          ink={ink}
                          disabled={busyResourceId === stop.resource.id}
                        >
                          I FINISHED THIS
                        </Chip>
                        <Chip
                          onClick={() =>
                            onFeedback(stop.resource.id, "struggled")
                          }
                          ink={ink}
                          disabled={busyResourceId === stop.resource.id}
                        >
                          I STRUGGLED HERE
                        </Chip>
                      </>
                    )}

                    <a
                      href={stop.resource.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-mono text-[0.7rem] tracking-[0.1em] underline underline-offset-4 focus-visible:outline-2"
                      style={{ color: muted }}
                    >
                      OPEN ↗
                    </a>
                  </div>

                  {isOpen && (
                    <div
                      className="mt-3"
                      style={{ borderLeft: `3px solid ${line}` }}
                    >
                      {prose[stop.resource.id] ? (
                        <p className="py-1 pl-4 text-sm" style={{ color: ink }}>
                          {prose[stop.resource.id]}
                        </p>
                      ) : phrasing === stop.resource.id ? (
                        <p
                          className="py-1 pl-4 font-mono text-sm"
                          style={{ color: muted }}
                        >
                          WRITING THIS UP
                          <span className="wp-ellipsis" />
                        </p>
                      ) : null}
                      <Reasoning
                        reasons={stop.reasons}
                        ink={ink}
                        muted={muted}
                      />
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/**
 * Ordinary stops are rings; interchanges are diamonds. The distinction carries
 * meaning — an interchange is where a milestone completes — so it is drawn as a
 * different shape rather than a different colour, which survives being
 * photographed off a projector.
 */
function Marker({
  milestone,
  walked,
  current,
  ink,
  line,
  paper,
  delay,
  animate,
}: {
  milestone: boolean;
  walked: boolean;
  current: boolean;
  ink: string;
  line: string;
  paper: string;
  delay: number;
  animate: boolean;
}) {
  const size = milestone ? 24 : 22;
  return (
    <span
      className={animate ? "wp-marker" : undefined}
      style={{
        position: "relative",
        zIndex: 10,
        width: size,
        height: size,
        flexShrink: 0,
        border: `${milestone ? 5 : 5}px solid ${walked || current ? line : ink}`,
        background: walked ? line : paper,
        borderRadius: milestone ? 0 : "999px",
        transform: milestone ? "rotate(45deg)" : undefined,
        boxShadow: current
          ? `0 0 0 4px ${paper}, 0 0 0 7px ${line}`
          : undefined,
        animationDelay: `${delay}ms`,
      }}
    />
  );
}

function Chip({
  children,
  onClick,
  ink,
  disabled,
  pressed,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ink: string;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className="border-2 px-3 py-1 font-mono text-[0.65rem] font-bold tracking-[0.12em] transition-colors disabled:opacity-45"
      style={{
        borderColor: ink,
        color: pressed ? undefined : ink,
        background: pressed ? ink : "transparent",
        ...(pressed ? { color: ink === INK ? PAPER : INK } : {}),
      }}
    >
      {children}
    </button>
  );
}

function Reasoning({
  reasons,
  ink,
  muted,
}: {
  reasons: Reasons;
  ink: string;
  muted: string;
}) {
  const rows: Array<[string, string]> = [];
  if (reasons.coversGapSkills.length > 0) {
    rows.push([
      "CLOSES",
      reasons.coversGapSkills
        .map((c) => `${c.name} ${c.fromLevel}▸${c.toLevel}`)
        .join(" · "),
    ]);
  }
  if (reasons.unlockedBy.length > 0) {
    rows.push([
      "NEEDS FIRST",
      [...new Set(reasons.unlockedBy.map((u) => u.title))].join(" · "),
    ]);
  }
  if (reasons.unlocks.length > 0) {
    rows.push(["OPENS UP", reasons.unlocks.map((u) => u.name).join(" · ")]);
  }
  rows.push([
    "FIT",
    `difficulty ${reasons.difficultyFit.resourceDifficulty}/5 against your level ${reasons.difficultyFit.learnerLevel} — ${reasons.difficultyFit.verdict}`,
  ]);
  rows.push(["COST", `${reasons.estHours} hours`]);

  return (
    <dl className="space-y-1.5 py-2 pl-4 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-3">
          <dt
            className="font-mono text-[0.65rem] tracking-[0.12em]"
            style={{ color: muted }}
          >
            {label}
          </dt>
          <dd
            className="min-w-0 font-mono text-[0.78rem]"
            style={{ color: ink }}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
