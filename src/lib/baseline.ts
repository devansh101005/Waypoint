import type { Resource } from "./types";

/**
 * The baseline we publish numbers against: semantic similarity between the
 * learner's stated goal and each resource's text, take the top k, present them
 * in similarity order. No skill tags, no prerequisite graph, no model of what
 * the learner already knows — this is what a competent team builds in a weekend
 * with an embedding API, and it is the thing our approach has to beat.
 *
 * It is implemented honestly and deliberately given every advantage that costs
 * us nothing: it sees the same corpus, the same descriptions and, when
 * embeddings are configured, the same embedding model. A rigged baseline would
 * make our numbers worthless.
 */

export interface BaselineOptions {
  k?: number;
  /**
   * Similarity per resource id. Supply real embedding cosines when a key is
   * configured; the lexical fallback below runs when they are unavailable so
   * the harness still produces a comparison offline.
   */
  similarity?: Map<string, number>;
}

export function baselinePath(
  resources: Resource[],
  queryText: string,
  options: BaselineOptions = {},
): { items: Array<{ resource: Resource }> } {
  const k = options.k ?? 8;
  const similarity =
    options.similarity ?? lexicalSimilarities(resources, queryText);

  const ranked = [...resources]
    .map((resource) => ({ resource, score: similarity.get(resource.id) ?? 0 }))
    .sort(
      (a, b) => b.score - a.score || a.resource.id.localeCompare(b.resource.id),
    )
    .slice(0, k);

  return { items: ranked.map(({ resource }) => ({ resource })) };
}

/**
 * Cosine over term-frequency vectors, used only when no embedding key is
 * configured. This is a stand-in for the baseline's semantic similarity, not a
 * retrieval index — the real system's lexical signal comes from Postgres.
 */
export function lexicalSimilarities(
  resources: Resource[],
  queryText: string,
): Map<string, number> {
  const queryTokens = tokenize(queryText);
  const queryVec = termFrequency(queryTokens);

  const out = new Map<string, number>();
  for (const r of resources) {
    const text = `${r.title} ${r.description} ${r.provider} ${r.type}`;
    out.set(r.id, cosine(queryVec, termFrequency(tokenize(text))));
  }
  return out;
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "for",
  "on",
  "with",
  "is",
  "it",
  "this",
  "that",
  "as",
  "by",
  "at",
  "from",
  "be",
  "are",
  "you",
  "your",
  "i",
  "want",
  "learn",
  "how",
  "can",
  "will",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [term, weight] of a) dot += weight * (b.get(term) ?? 0);
  if (dot === 0) return 0;
  const norm = (m: Map<string, number>) =>
    Math.sqrt([...m.values()].reduce((sum, v) => sum + v * v, 0));
  const denominator = norm(a) * norm(b);
  return denominator > 0 ? dot / denominator : 0;
}
