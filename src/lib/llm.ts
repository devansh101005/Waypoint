import OpenAI from "openai";
import type { z } from "zod";
import { env } from "./env";

/**
 * LLM access through the Rikko gateway (OpenAI-compatible).
 *
 * Model roles are env-driven so swapping a model is config, not code:
 *   primary  — chat, extraction, explanations
 *   fast     — cheap bulk calls
 *   showcase — optional higher-tier model for the final demo recording
 */

let cached: OpenAI | null = null;

export function llm(): OpenAI {
  if (!cached) {
    cached = new OpenAI({
      apiKey: env.llmApiKey,
      baseURL: env.llmBaseUrl,
    });
  }
  return cached;
}

export type ModelRole = "primary" | "fast" | "showcase";

export function modelFor(role: ModelRole): string {
  switch (role) {
    case "fast":
      return env.modelFast;
    case "showcase":
      return env.modelShowcase;
    default:
      return env.modelPrimary;
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Plain completion. Returns the assistant text. */
export async function complete(
  messages: ChatMessage[],
  opts: { role?: ModelRole; maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const res = await llm().chat.completions.create({
    model: modelFor(opts.role ?? "primary"),
    messages,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.3,
  });
  return res.choices[0]?.message?.content ?? "";
}

/** Streaming completion, yielding text deltas. */
export async function* stream(
  messages: ChatMessage[],
  opts: { role?: ModelRole; maxTokens?: number; temperature?: number } = {},
): AsyncGenerator<string> {
  const s = await llm().chat.completions.create({
    model: modelFor(opts.role ?? "primary"),
    messages,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.5,
    stream: true,
  });
  for await (const chunk of s) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("no JSON found in model output");
  // Walk to the matching closing bracket so trailing prose is tolerated.
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return JSON.parse(candidate.slice(start, i + 1));
    }
  }
  throw new Error("unterminated JSON in model output");
}

/**
 * Structured extraction: ask for JSON, validate with Zod, retry once with the
 * validation error fed back. Gateways vary in `response_format` support, so we
 * ask for JSON in the prompt AND parse defensively rather than trusting a flag.
 */
export async function extractJSON<T>(
  schema: z.ZodType<T>,
  messages: ChatMessage[],
  opts: { role?: ModelRole; maxTokens?: number } = {},
): Promise<T> {
  const model = modelFor(opts.role ?? "primary");
  const base: ChatMessage[] = [
    ...messages,
    {
      role: "system",
      content: "Reply with JSON only. No prose, no code fences.",
    },
  ];

  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const convo: ChatMessage[] =
      attempt === 0
        ? base
        : [
            ...base,
            {
              role: "system",
              content: `Your previous reply failed validation: ${lastErr}. Return corrected JSON only.`,
            },
          ];

    const res = await llm().chat.completions.create({
      model,
      messages: convo,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: 0,
    });
    const text = res.choices[0]?.message?.content ?? "";

    try {
      return schema.parse(extractJson(text));
    } catch (e) {
      lastErr = e instanceof Error ? e.message.slice(0, 500) : String(e);
    }
  }
  throw new Error(`Structured extraction failed after retry: ${lastErr}`);
}
