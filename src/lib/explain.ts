import { complete, type ChatMessage, type ModelRole } from "./llm";
import type { Reasons } from "./types";

/**
 * Turning a plan into prose.
 *
 * The planner emits a `reasons` object for every step. The model's only job is
 * to phrase that object in second person — it does not choose resources, does
 * not decide ordering, and has no access to the catalogue. A model that cannot
 * recommend cannot hallucinate a recommendation.
 *
 * Three defences, in order:
 *   1. the prompt carries only the reasons object, never the corpus;
 *   2. the response is checked for skill names that are not in that object, and
 *      rejected if it invented one;
 *   3. any failure falls back to a deterministic template, so a dead API or a
 *      drifting model degrades the prose rather than breaking the product.
 */

export interface ExplainInput {
  title: string;
  position: number;
  reasons: Reasons;
}

export interface ExplainOptions {
  role?: ModelRole;
  /** Every skill name in the corpus, used to detect invented ones. */
  knownSkillNames?: string[];
  /** Injectable for tests; defaults to the real LLM call. */
  completion?: (
    messages: ChatMessage[],
    opts?: { role?: ModelRole },
  ) => Promise<string>;
}

export interface Explanation {
  text: string;
  source: "model" | "template";
  /** Set when a model reply was rejected, for the logs and the eval writeup. */
  rejectedBecause?: string;
}

/**
 * The deterministic rendering. Also the fallback, so it has to read well enough
 * to ship on its own — it is what a judge sees if the API is down mid-demo.
 */
export function renderTemplate(input: ExplainInput): string {
  const { reasons } = input;
  const sentences: string[] = [];

  const covers = reasons.coversGapSkills;
  if (covers.length === 1) {
    const c = covers[0];
    sentences.push(
      `This takes your ${c.name} from level ${fmt(c.fromLevel)} to ${fmt(c.toLevel)}.`,
    );
  } else if (covers.length > 1) {
    const names = list(covers.map((c) => c.name));
    sentences.push(
      `This covers ${names}, which your goal needs and you do not have yet.`,
    );
  } else {
    sentences.push(
      "This step consolidates what you have already been working on.",
    );
  }

  if (reasons.unlockedBy.length > 0) {
    const titles = list([...new Set(reasons.unlockedBy.map((u) => u.title))]);
    sentences.push(
      `It comes after ${titles} because it assumes what ${reasons.unlockedBy.length > 1 ? "they teach" : "that teaches"}.`,
    );
  }

  if (reasons.unlocks.length > 0) {
    sentences.push(
      `Finishing it opens up ${list(reasons.unlocks.map((u) => u.name))}.`,
    );
  }

  const fit = reasons.difficultyFit;
  if (fit.verdict === "stretch") {
    sentences.push(
      `At difficulty ${fit.resourceDifficulty} of 5 this is a stretch from where you are, so expect it to be demanding.`,
    );
  } else if (fit.verdict === "easy") {
    sentences.push(
      `At difficulty ${fit.resourceDifficulty} of 5 this should feel comfortable.`,
    );
  } else {
    sentences.push(
      `At difficulty ${fit.resourceDifficulty} of 5 it is pitched just above your current level.`,
    );
  }

  sentences.push(`Budget about ${fmtHours(reasons.estHours)}.`);

  if (reasons.milestoneContribution) {
    sentences.push(
      `This one completes a milestone: ${stripPrefix(reasons.milestoneContribution)}.`,
    );
  }

  return sentences.join(" ");
}

const SYSTEM_PROMPT = `You explain one step of a learner's study plan.

You will be given a JSON object of facts about that step. Rephrase those facts in warm, direct
second person ("you"), in 2-4 short sentences.

Hard rules:
- Use ONLY the facts in the JSON. Never mention a course, resource, skill, tool or technology that
  does not appear in it.
- Never invent levels, hours, prerequisites or claims about difficulty.
- Do not add encouragement that implies knowledge you do not have about the learner.
- No preamble, no bullet points, no markdown. Plain sentences only.`;

export async function explainStep(
  input: ExplainInput,
  options: ExplainOptions = {},
): Promise<Explanation> {
  const fallback = () => renderTemplate(input);
  const call = options.completion ?? ((m, o) => complete(m, o));

  const payload = {
    step: input.position,
    title: input.title,
    covers: input.reasons.coversGapSkills,
    comesAfter: input.reasons.unlockedBy.map((u) => ({
      title: u.title,
      skill: u.skillId,
    })),
    opensUp: input.reasons.unlocks.map((u) => u.name),
    difficulty: input.reasons.difficultyFit,
    estimatedHours: input.reasons.estHours,
    milestone: input.reasons.milestoneContribution,
  };

  let text: string;
  try {
    text = (
      await call(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(payload, null, 2) },
        ],
        { role: options.role ?? "primary" },
      )
    ).trim();
  } catch {
    return {
      text: fallback(),
      source: "template",
      rejectedBecause: "model call failed",
    };
  }

  const rejection = validate(text, input, options.knownSkillNames ?? []);
  if (rejection) {
    return { text: fallback(), source: "template", rejectedBecause: rejection };
  }
  return { text, source: "model" };
}

/**
 * Reject a reply that strayed outside the facts it was given. The check that
 * matters is the last one: if the model names a skill from the catalogue that
 * this step has nothing to do with, it is improvising, and we take the
 * deterministic version instead.
 */
export function validate(
  text: string,
  input: ExplainInput,
  knownSkillNames: string[],
): string | null {
  if (text.length < 20) return "reply too short";
  if (text.length > 1200) return "reply too long";

  const lower = text.toLowerCase();
  const permitted = new Set(
    [
      ...input.reasons.coversGapSkills.map((c) => c.name),
      ...input.reasons.unlocks.map((u) => u.name),
      input.title,
    ].map((n) => n.toLowerCase()),
  );

  for (const name of knownSkillNames) {
    const needle = name.toLowerCase();
    if (permitted.has(needle)) continue;
    // Word-boundary match so "Joins" does not fire inside "adjoins".
    const pattern = new RegExp(`\\b${escapeRegex(needle)}\\b`, "i");
    if (pattern.test(lower))
      return `mentioned "${name}", which is not part of this step`;
  }
  return null;
}

/** Explain a whole path. Steps are independent, so they go out concurrently. */
export async function explainPath(
  steps: ExplainInput[],
  options: ExplainOptions = {},
): Promise<Explanation[]> {
  return Promise.all(steps.map((step) => explainStep(step, options)));
}

// ---------- formatting helpers ----------

function fmt(level: number): string {
  return Number.isInteger(level) ? String(level) : level.toFixed(1);
}

function fmtHours(hours: number): string {
  if (hours < 1) return "under an hour";
  if (hours === 1) return "an hour";
  return `${Math.round(hours)} hours`;
}

function list(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function stripPrefix(label: string): string {
  return label.replace(/^Milestone:\s*/i, "");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
