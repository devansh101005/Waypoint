"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { TransitRoute, type RouteStop } from "./route";
import { INK, LINE, LINE_INK, ON_INK, PAPER } from "./theme";

/**
 * The worked example on the landing page, and the re-plot that follows it.
 *
 * Both routes are produced by the real planner against the live corpus and
 * passed in — nothing here is written by hand. The adaptation is the most
 * important thing the product does and it cannot be seen in a screenshot, so it
 * is offered as a control: flip the switch and the route re-plots in front of
 * you, with the diff the planner actually generated.
 *
 * The re-plot is choreographed in three beats — dropped stops leave, survivors
 * slide up to close the gap, new stops draw in — because the claim being made
 * is "we kept what still applies and changed the rest". A straight swap would
 * show the same two routes without ever showing the relationship between them.
 */

export interface DemoRouteProps {
  learner: string;
  before: RouteStop[];
  after: RouteStop[];
  struggledWith: string;
  diffSummary: string;
  addedIds: string[];
}

const LEAVE_MS = 280;

/**
 * The survivor slide has to be applied before the browser paints the collapsed
 * layout, or the stops visibly jump up and then animate again. useLayoutEffect
 * gives that, but it warns when React renders this on the server, where there
 * is no layout to read — so on the server it degrades to the ordinary effect,
 * which never runs there anyway.
 */
const useBeforePaint =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function DemoRoute({
  learner,
  before,
  after,
  struggledWith,
  diffSummary,
  addedIds,
}: DemoRouteProps) {
  const [adapted, setAdapted] = useState(false);
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  const [replotting, setReplotting] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const marks = useRef<Map<string, number>>(new Map());
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => timers.current.forEach((t) => window.clearTimeout(t)),
    [],
  );

  const measure = useCallback(() => {
    const map = new Map<string, number>();
    listRef.current
      ?.querySelectorAll<HTMLElement>("[data-stop-id]")
      .forEach((li) => {
        const id = li.dataset.stopId;
        if (id) map.set(id, li.getBoundingClientRect().top);
      });
    return map;
  }, []);

  /** Measure, invert, release: survivors animate from where they used to be. */
  const slideSurvivors = useCallback(() => {
    // Under reduced motion the transition is off, so inverting would offset the
    // stops for exactly one frame and snap them back — a flash, which is the
    // one thing the preference is asking us not to do.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const now = measure();
    listRef.current
      ?.querySelectorAll<HTMLElement>("[data-stop-id]")
      .forEach((li) => {
        const id = li.dataset.stopId;
        if (!id) return;
        const was = marks.current.get(id);
        const is = now.get(id);
        if (was === undefined || is === undefined || was === is) return;

        li.style.transform = `translateY(${was - is}px)`;
        li.classList.remove("wp-sliding");
        requestAnimationFrame(() => {
          li.classList.add("wp-sliding");
          li.style.transform = "";
        });
      });
    marks.current = now;
  }, [measure]);

  function replot() {
    if (replotting) return;
    const next = !adapted;

    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setAdapted(next);
      return;
    }

    const keptIds = new Set((next ? after : before).map((s) => s.resource.id));
    const dropped = new Set(
      (next ? before : after)
        .map((s) => s.resource.id)
        .filter((id) => !keptIds.has(id)),
    );

    marks.current = measure();

    if (dropped.size === 0) {
      setAdapted(next);
      return;
    }

    // Beat one: the dropped stops fade out while the rest hold still.
    setReplotting(true);
    setLeavingIds(dropped);
    timers.current.push(
      window.setTimeout(() => {
        setLeavingIds(new Set());
        setAdapted(next);
        setReplotting(false);
      }, LEAVE_MS),
    );
  }

  // Beat two: once the list has reflowed, survivors slide from their old rows.
  useBeforePaint(() => {
    if (leavingIds.size > 0) return;
    slideSurvivors();
  }, [adapted, leavingIds, slideSurvivors]);

  // During beat one `adapted` has not flipped yet, so this is still the outgoing
  // route — dropped stops included, which is what lets them animate away.
  const stops = adapted ? after : before;
  const hours = Math.round(
    stops.reduce((sum, s) => sum + s.resource.estHours, 0),
  );

  return (
    <div>
      <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className="wp-display text-[clamp(1.8rem,4vw,3rem)] leading-none font-extrabold tracking-[-0.02em]">
            A ROUTE, PLOTTED
          </h2>
          <p
            className="mt-3 max-w-lg text-sm leading-relaxed"
            style={{ color: ON_INK.muted }}
          >
            {learner}
          </p>
        </div>

        <button
          type="button"
          onClick={replot}
          aria-pressed={adapted}
          className="flex items-center gap-3 px-5 py-3 text-left transition-colors"
          style={{
            background: adapted ? LINE.accent : "transparent",
            color: adapted ? INK : PAPER,
            border: `3px solid ${adapted ? LINE.accent : PAPER}`,
          }}
        >
          <span
            aria-hidden="true"
            className="grid size-5 shrink-0 place-items-center border-2"
            style={{ borderColor: "currentColor" }}
          >
            {adapted && (
              <span className="size-2" style={{ background: "currentColor" }} />
            )}
          </span>
          <span className="font-mono text-[0.7rem] leading-tight font-bold tracking-[0.12em]">
            THEY STRUGGLED WITH
            <br />
            {struggledWith.toUpperCase()} — RE-PLOT
          </span>
        </button>
      </div>

      <dl
        className="mb-9 grid gap-px sm:grid-cols-4"
        style={{ background: ON_INK.hairline }}
      >
        {[
          { k: "STOPS", v: stops.length, tick: true },
          { k: "HOURS", v: hours, accent: true, tick: true },
          { k: "VIOLATIONS", v: 0, tick: false },
          { k: "REACHES GOAL", v: "YES", tick: false },
        ].map((cell) => (
          <div key={cell.k} className="px-4 py-3" style={{ background: INK }}>
            <dt
              className="font-mono text-[0.62rem] font-bold tracking-[0.18em]"
              style={{ color: ON_INK.muted }}
            >
              {cell.k}
            </dt>
            <dd
              className="wp-display mt-1 text-2xl font-extrabold tabular-nums"
              style={{ color: cell.accent ? LINE.accent : PAPER }}
            >
              {cell.tick && typeof cell.v === "number" ? (
                <Ticker value={cell.v} />
              ) : (
                cell.v
              )}
            </dd>
          </div>
        ))}
      </dl>

      {adapted && (
        <p
          aria-live="polite"
          className="mb-8 py-2 pl-4 text-sm leading-relaxed"
          style={{ borderLeft: `4px solid ${LINE.accent}` }}
        >
          <span
            className="font-mono text-[0.66rem] font-bold tracking-[0.18em]"
            style={{ color: LINE.accent }}
          >
            ROUTE UPDATED ·{" "}
          </span>
          {diffSummary}
        </p>
      )}

      <TransitRoute
        stops={stops}
        onInk
        listRef={listRef}
        leavingResourceIds={leavingIds}
        changedResourceIds={adapted ? new Set(addedIds) : undefined}
      />

      <p
        className="mt-2 font-mono text-[0.68rem]"
        style={{ color: ON_INK.muted }}
      >
        BOTH ROUTES ARE REAL PLANNER OUTPUT AGAINST THE LIVE CORPUS
        {LINE_INK ? "" : ""}
      </p>
    </div>
  );
}

/**
 * A figure that rolls to its new value when the route changes. It renders the
 * real number on first paint and on every settle, so it is only ever mid-count
 * during the ~400ms after a re-plot the reader just asked for.
 */
function Ticker({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  // What is on screen right now, so a re-plot mid-roll starts from there.
  const onScreen = useRef(value);

  useEffect(() => {
    const start = onScreen.current;
    if (start === value) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onScreen.current = value;
      setShown(value);
      return;
    }

    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / 420);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(start + (value - start) * eased);
      onScreen.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{shown}</>;
}
