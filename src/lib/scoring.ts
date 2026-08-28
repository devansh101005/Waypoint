import { levelToMastery } from "./mastery";
import type { Gap, Resource, ScoreBreakdown } from "./types";

/**
 * Hybrid relevance scoring for a short, skill-tagged corpus.
 *
 * The weighting is deliberately the inverse of document search: metadata is the
 * primary signal and text similarity is the tiebreaker. A course's tags say
 * what it actually teaches; its prose is marketing. Text still matters for
 * catching the nuance tags miss ("for absolute beginners", "with Python").
 */

export const DEFAULT_WEIGHTS = { tag: 0.5, dense: 0.3, lexical: 0.2 } as const;

export type SignalWeights = { tag: number; dense: number; lexical: number };

export interface ScoreInput {
  /** Cosine similarity of the gap card against the resource card, if embeddings exist. */
  dense?: number | null;
  /** Lexical relevance (Postgres ts_rank, normalised to 0..1), if computed. */
  lexical?: number | null;
  weights?: SignalWeights;
}

/**
 * How much of the important part of the gap this resource closes.
 *
 * Normalised against the three heaviest gap entries rather than the whole gap,
 * so a resource is measured on whether it advances what matters most — not
 * penalised for failing to single-handedly complete a six-month goal.
 */
export function tagScore(resource: Resource, gap: Gap): number {
  if (gap.length === 0) return 0;

  const byId = new Map(gap.map((g) => [g.skillId, g]));
  let gained = 0;
  for (const t of resource.teaches) {
    const g = byId.get(t.skillId);
    if (!g) continue;
    const reach = Math.min(levelToMastery(t.level), g.target);
    gained += g.weight * Math.max(0, reach - g.current);
  }
  if (gained <= 0) return 0;

  const reference = [...gap]
    .map((g) => g.weight * Math.max(0, g.target - g.current))
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((a, b) => a + b, 0);

  return reference > 0 ? Math.min(1, gained / reference) : 0;
}

/** Better resources win ties; never strong enough to promote an irrelevant one. */
export function qualityPrior(resource: Resource): number {
  return 0.8 + 0.04 * clamp(resource.quality, 1, 5);
}

/**
 * Combine the available signals. Missing signals are not treated as zero — they
 * are dropped and the remaining weights renormalised, so a corpus without
 * embeddings ranks on tags and text rather than scoring everything near zero.
 */
export function scoreResource(
  resource: Resource,
  gap: Gap,
  input: ScoreInput = {},
): ScoreBreakdown {
  const weights = input.weights ?? DEFAULT_WEIGHTS;
  const tag = tagScore(resource, gap);
  const dense = input.dense ?? null;
  const lexical = input.lexical ?? null;

  let weighted = weights.tag * tag;
  let totalWeight = weights.tag;
  if (dense !== null) {
    weighted += weights.dense * clamp(dense, 0, 1);
    totalWeight += weights.dense;
  }
  if (lexical !== null) {
    weighted += weights.lexical * clamp(lexical, 0, 1);
    totalWeight += weights.lexical;
  }

  const prior = qualityPrior(resource);
  const total = totalWeight > 0 ? (weighted / totalWeight) * prior : 0;

  return {
    tag,
    dense: dense ?? 0,
    lexical: lexical ?? 0,
    qualityPrior: prior,
    total,
  };
}

/**
 * The baseline we publish numbers against: rank by text similarity alone,
 * ignoring skill tags, prerequisites and what the learner already knows. This
 * is the standard approach, implemented honestly so the comparison is fair.
 */
export function scoreBaseline(input: ScoreInput = {}): ScoreBreakdown {
  const dense = input.dense ?? null;
  const lexical = input.lexical ?? null;
  const total = dense ?? lexical ?? 0;
  return {
    tag: 0,
    dense: dense ?? 0,
    lexical: lexical ?? 0,
    qualityPrior: 1,
    total: clamp(total, 0, 1),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
