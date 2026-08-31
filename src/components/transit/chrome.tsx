import Link from "next/link";
import { INK, LINE_INK, PAPER } from "./theme";

/**
 * The bar that runs across every screen.
 *
 * Shared so the product screens cannot drift from the landing page — the drift
 * is exactly what happens when each page draws its own header, and it is the
 * first thing that makes a build look assembled rather than designed.
 */

export function TransitBar({ line = "LINE 01 · DATA" }: { line?: string }) {
  return (
    <header style={{ background: INK, color: PAPER }} className="relative z-20">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <Link
          href="/"
          className="wp-display text-[0.95rem] font-extrabold tracking-[0.3em]"
        >
          WAYPOINT
        </Link>
        <span
          className="px-2 py-0.5 font-mono text-[0.7rem] font-bold tracking-[0.18em]"
          style={{ background: LINE_INK.data, color: PAPER }}
        >
          {line}
        </span>
        <nav className="ml-auto flex flex-wrap gap-x-5 gap-y-1 text-[0.7rem] font-semibold tracking-[0.18em]">
          <Link href="/start" className="hover:opacity-70">
            DESCRIBE A GOAL
          </Link>
          <Link href="/plan" className="hover:opacity-70">
            PICK A DESTINATION
          </Link>
          <Link href="/dashboard/demo" className="hover:opacity-70">
            DASHBOARD
          </Link>
          <Link href="/eval" className="hover:opacity-70">
            EVIDENCE
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** The measurement strip: a row of readings, set like a departure board. */
export function ReadingStrip({
  readings,
}: {
  readings: Array<{ label: string; value: string; accent?: boolean }>;
}) {
  return (
    <dl
      className="grid gap-px sm:grid-cols-2 lg:grid-cols-4"
      style={{ background: INK }}
    >
      {readings.map((reading) => (
        <div
          key={reading.label}
          className="px-4 py-3"
          style={{ background: PAPER }}
        >
          <dt className="font-mono text-[0.62rem] font-bold tracking-[0.18em] opacity-60">
            {reading.label}
          </dt>
          <dd
            className="wp-display mt-1 text-2xl font-extrabold tabular-nums"
            style={{ color: reading.accent ? LINE_INK.accent : INK }}
          >
            {reading.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
