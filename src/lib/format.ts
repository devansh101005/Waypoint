/**
 * How the measured figures are written, in one place.
 *
 * Separate from site-stats because the client components that animate these
 * numbers need the formatting but must not pull the store — and everything
 * else — into the browser bundle.
 */

export function asPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function asScore(value: number): string {
  // Minus sign rather than a hyphen: these sit in tabular figures.
  return value.toFixed(3).replace(/^-/, "\u2212");
}

/** Named so the choice can cross the server/client boundary as data. */
export type FigureFormat = "percent" | "score";

export function formatFigure(value: number, format: FigureFormat): string {
  return format === "percent" ? asPercent(value) : asScore(value);
}
