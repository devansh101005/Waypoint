/**
 * The transit system's fixed vocabulary.
 *
 * These values were being redeclared in every file that used them, which is how
 * a design system drifts: one screen ends up a shade off and nobody can say
 * which one is right. Everything visual imports from here.
 *
 * The ink/line split matters. Line colours are mixed for thick strokes on a
 * diagram; at label size they fall under the 4.5:1 contrast floor, so each has
 * a darker sibling for small text. Using the wrong one is an accessibility
 * failure, not a preference.
 */

export const INK = "#16161A";
export const PAPER = "#F4F3EF";
export const PAPER_RAISED = "#FAF9F6";

/** Line colours — thick strokes, large numerals, swatches. */
export const LINE = {
  data: "#D82A24",
  web: "#1B45C4",
  foundations: "#00734A",
  accent: "#E39A0C",
} as const;

/** The same hues, darkened for anything set at label size. */
export const LINE_INK = {
  data: "#AE1B16",
  web: "#1B45C4",
  foundations: "#00734A",
  accent: "#8A5B00",
} as const;

/** On the ink panel the light line colours read; the dark ones do not. */
export const ON_INK = {
  data: "#FF6B63",
  accent: LINE.accent,
  muted: "rgba(244,243,239,0.72)",
  hairline: "rgba(244,243,239,0.22)",
} as const;

export type LineName = keyof typeof LINE;

/** Domains map onto lines, so a skill's colour is never arbitrary. */
export function lineForDomain(domain: string): LineName {
  if (domain.startsWith("web")) return "web";
  if (domain.startsWith("data")) return "data";
  return "foundations";
}
