import { CohereClient } from "cohere-ai";
import { env } from "./env";
import type { Resource } from "./types";

/**
 * Embeddings + rerank via Cohere. Both are optional by design: without a key,
 * embed() returns null and the hybrid scorer renormalizes onto tag + lexical
 * signal. Nothing in the pipeline may hard-fail on a missing embedding.
 */

const DIM = 1536;

let cached: CohereClient | null = null;
function client(): CohereClient | null {
  if (!env.hasCohere) return null;
  if (!cached) cached = new CohereClient({ token: env.cohereApiKey });
  return cached;
}

/** The text we actually embed for a resource: structured, not raw description. */
export function resourceCard(r: Resource): string {
  const teaches = r.teaches
    .map((s) => `${s.skillId} (level ${s.level})`)
    .join(", ");
  const requires =
    r.requires.map((s) => `${s.skillId} (level ${s.level})`).join(", ") ||
    "none";
  return [
    `${r.title} — ${r.type} by ${r.provider || "unknown"}`,
    `Teaches: ${teaches}`,
    `Requires: ${requires}`,
    `Difficulty ${r.difficulty}/5, about ${r.estHours} hours.`,
    r.description,
  ].join("\n");
}

async function embedBatch(
  texts: string[],
  inputType: "search_document" | "search_query",
): Promise<number[][] | null> {
  const c = client();
  if (!c || texts.length === 0) return null;
  try {
    // v2 is the namespace that supports embed-v4.0 and an explicit output
    // dimension (must match the vector(1536) column in the schema).
    const res = await c.v2.embed({
      texts,
      model: "embed-v4.0",
      inputType,
      embeddingTypes: ["float"],
      outputDimension: DIM,
    });
    return res.embeddings.float ?? null;
  } catch (err) {
    console.warn(
      "[embeddings] Cohere embed failed, continuing without dense signal:",
      err,
    );
    return null;
  }
}

export async function embedDocuments(
  texts: string[],
): Promise<number[][] | null> {
  return embedBatch(texts, "search_document");
}

export async function embedQuery(text: string): Promise<number[] | null> {
  const out = await embedBatch([text], "search_query");
  return out?.[0] ?? null;
}

/** Hosted cross-encoder rerank. Returns null when unavailable — caller keeps its order. */
export async function rerank(
  query: string,
  docs: Array<{ id: string; text: string }>,
  topN: number,
): Promise<Array<{ id: string; relevance: number }> | null> {
  const c = client();
  if (!c || !env.rerankEnabled || docs.length === 0) return null;
  try {
    const res = await c.v2.rerank({
      model: "rerank-v3.5",
      query,
      documents: docs.map((d) => d.text),
      topN: Math.min(topN, docs.length),
    });
    return res.results.map((r) => ({
      id: docs[r.index].id,
      relevance: r.relevanceScore,
    }));
  } catch (err) {
    console.warn(
      "[embeddings] Cohere rerank failed, keeping hybrid order:",
      err,
    );
    return null;
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export const EMBEDDING_DIM = DIM;
