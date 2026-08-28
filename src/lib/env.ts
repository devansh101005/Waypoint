/**
 * Central env access. Nothing else in the app reads process.env directly, so a
 * missing key fails in one obvious place with an actionable message.
 */

function req(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing env var ${name}. Add it to .env.local (see .env.example) and to Vercel project settings.`,
    );
  }
  return v;
}

function opt(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  get databaseUrl() {
    return req("DATABASE_URL");
  },

  // Rikko gateway (OpenAI-compatible).
  get llmApiKey() {
    return req("RIKKO_API_KEY");
  },
  get llmBaseUrl() {
    return opt("LLM_BASE_URL", "https://myrikko.ai/v1");
  },
  get modelPrimary() {
    return opt("LLM_MODEL_PRIMARY", "deepseek-v4-pro-0813");
  },
  get modelFast() {
    return opt("LLM_MODEL_FAST", "glm-5.3-flash");
  },
  get modelShowcase() {
    return opt("LLM_MODEL_SHOWCASE", "claude-opus-5");
  },

  // Cohere is optional: retrieval degrades to tag + lexical signals without it.
  get cohereApiKey() {
    return opt("COHERE_API_KEY");
  },
  get hasCohere() {
    return Boolean(process.env.COHERE_API_KEY);
  },
  get rerankEnabled() {
    return Boolean(process.env.COHERE_API_KEY) && opt("RERANK", "on") === "on";
  },
} as const;
