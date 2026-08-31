import { z } from "zod";
import type { SkillGraph } from "./graph";
import { extractJSON, type ChatMessage, type ModelRole } from "./llm";
import type { LearnerConstraints, SkillRef } from "./types";

/**
 * Turning "I want to be a data analyst" into a target skill state.
 *
 * The model is constrained to the canonical skill list: it picks slugs, it does
 * not invent them. Anything it returns that is not in the graph is dropped
 * before it can reach the planner, so a confused extraction produces a smaller
 * goal rather than a broken one.
 */

const skillRefSchema = z.object({
  skill: z.string(),
  level: z.number().int().min(1).max(5),
});

const intakeSchema = z.object({
  goalSkills: z.array(skillRefSchema).default([]),
  statedSkills: z.array(skillRefSchema).default([]),
  constraints: z
    .object({
      hoursPerWeek: z.number().positive().max(80).optional(),
      deadlineWeeks: z.number().positive().max(260).optional(),
      formats: z.array(z.string()).optional(),
    })
    .default({}),
  /** The model's read of what the learner wants, for the profile panel. */
  goalSummary: z.string().default(""),
  /** What is still missing before a path can be generated. */
  followUpQuestion: z.string().nullable().default(null),
});

export type RawIntake = z.infer<typeof intakeSchema>;

export interface IntakeResult {
  goalSkills: SkillRef[];
  statedSkills: SkillRef[];
  constraints: LearnerConstraints;
  goalSummary: string;
  followUpQuestion: string | null;
  /** Slugs the model produced that are not in the graph. Surfaced, not hidden. */
  droppedSkills: string[];
  ready: boolean;
}

export interface IntakeOptions {
  role?: ModelRole;
  /** Injectable for tests; defaults to the real structured-extraction call. */
  extractor?: (messages: ChatMessage[]) => Promise<RawIntake>;
  /** Cap the slug list sent to the model. */
  maxSkillsInPrompt?: number;
}

function systemPrompt(graph: SkillGraph, limit: number): string {
  const catalogue = graph
    .all()
    .slice(0, limit)
    .map((s) => `${s.id} (${s.name}, ${s.domain})`)
    .join("\n");

  return `You read a learner's message and extract a structured profile.

Available skills — you may ONLY use these exact slugs:
${catalogue}

Return JSON with this shape:
{
  "goalSkills":   [{"skill": "<slug>", "level": 1-5}],
  "statedSkills": [{"skill": "<slug>", "level": 1-5}],
  "constraints":  {"hoursPerWeek": number?, "deadlineWeeks": number?, "formats": [string]?},
  "goalSummary":  "one sentence, second person, describing what they want",
  "followUpQuestion": "one question, or null if you have enough"
}

Rules:
- goalSkills are the destination: the skills that, once held at the stated level, mean the
  learner has actually arrived at what they asked for. Do not list prerequisites — those are
  derived from the skill graph automatically.

- Match the BREADTH of the goal to the breadth of the ambition:
    one concrete task ("build a dashboard for my team")        -> 1-2 skills
    a subject area ("learn machine learning properly")          -> 3-4 skills
    a role or career ("become a data analyst", "be employable") -> 4-6 skills
  A career is not one skill. Someone who wants to be hired as a front-end developer needs the
  whole working set, not just the language.

- Match the LEVEL to what they need to DO with it, not to a default:
    2 = follow a tutorial, dabble, satisfy curiosity
    3 = use it independently on their own work
    4 = employable, works professionally, knows the pitfalls   <- the right level for any goal
        phrased as getting a job, being hired, becoming a <role>, or being "employable"
    5 = could teach it or lead others
  Do not put everything at 3. Read what they actually said they want to be able to do.

- statedSkills are only what the learner claims. Never infer from their goal.

- Two different failures need two different answers. Do not confuse them.

  VAGUE BUT IN SCOPE — the goal is something this catalogue covers, but not yet specific
  enough to pick a destination ("I want to work with AI", "something with computers").
  Return empty goalSkills and ask ONE concrete question that offers real alternatives.

  OUT OF SCOPE — the goal is not about data science or web development at all: civil
  service exams, medicine, law, teaching, music, sport, spoken languages, finance
  qualifications. This catalogue covers exactly two domains and cannot plan a route to
  anything else. Return empty goalSkills, and in followUpQuestion:
    1. say plainly that Waypoint only plans data-science and web-development routes, so
       this is not something it can chart;
    2. if some genuine part of their goal touches those two domains, name that part
       concretely and offer to plan it.
  Never ask an out-of-scope learner to choose skills from the catalogue themselves. They
  came for a plan; asking them to browse our list makes our problem theirs, and implies
  the goal is reachable here when it is not. Be brief and direct, never apologetic.

- Never invent a slug. If nothing fits, leave the array empty.`;
}

export async function extractIntake(
  messages: ChatMessage[],
  graph: SkillGraph,
  options: IntakeOptions = {},
): Promise<IntakeResult> {
  const limit = options.maxSkillsInPrompt ?? 400;
  const convo: ChatMessage[] = [
    { role: "system", content: systemPrompt(graph, limit) },
    ...messages,
  ];

  const raw = options.extractor
    ? await options.extractor(convo)
    : await extractJSON(intakeSchema, convo, {
        role: options.role ?? "primary",
      });

  return normalise(raw, graph);
}

/** Drop anything not in the graph, deduplicate, keep the highest level per skill. */
export function normalise(raw: RawIntake, graph: SkillGraph): IntakeResult {
  const dropped: string[] = [];

  const clean = (refs: Array<{ skill: string; level: number }>): SkillRef[] => {
    const best = new Map<string, number>();
    for (const ref of refs) {
      const slug = ref.skill.trim();
      if (!graph.has(slug)) {
        if (slug) dropped.push(slug);
        continue;
      }
      const level = Math.min(5, Math.max(1, Math.round(ref.level)));
      best.set(slug, Math.max(best.get(slug) ?? 0, level));
    }
    return [...best].map(([skillId, level]) => ({ skillId, level }));
  };

  const goalSkills = clean(raw.goalSkills ?? []);
  const statedSkills = clean(raw.statedSkills ?? []);

  const constraints: LearnerConstraints = {};
  if (raw.constraints?.hoursPerWeek)
    constraints.hoursPerWeek = raw.constraints.hoursPerWeek;
  if (raw.constraints?.deadlineWeeks)
    constraints.deadlineWeeks = raw.constraints.deadlineWeeks;
  if (raw.constraints?.formats?.length)
    constraints.formats = raw.constraints.formats;

  return {
    goalSkills,
    statedSkills,
    constraints,
    goalSummary: (raw.goalSummary ?? "").trim(),
    followUpQuestion: raw.followUpQuestion?.trim() || null,
    droppedSkills: [...new Set(dropped)],
    // A path needs somewhere to go. Everything else can be discovered later.
    ready: goalSkills.length > 0,
  };
}

/**
 * Merge a new extraction into the profile built so far. Later turns refine
 * earlier ones rather than replacing them, so a learner who adds "actually I
 * already know SQL" three messages in does not lose their goal.
 */
export function mergeIntake(
  previous: IntakeResult | null,
  next: IntakeResult,
): IntakeResult {
  if (!previous) return next;

  const merge = (a: SkillRef[], b: SkillRef[]): SkillRef[] => {
    const best = new Map<string, number>();
    for (const ref of [...a, ...b]) {
      best.set(ref.skillId, Math.max(best.get(ref.skillId) ?? 0, ref.level));
    }
    return [...best].map(([skillId, level]) => ({ skillId, level }));
  };

  const goalSkills =
    next.goalSkills.length > 0
      ? merge(previous.goalSkills, next.goalSkills)
      : previous.goalSkills;

  return {
    goalSkills,
    statedSkills: merge(previous.statedSkills, next.statedSkills),
    constraints: { ...previous.constraints, ...next.constraints },
    goalSummary: next.goalSummary || previous.goalSummary,
    followUpQuestion: next.followUpQuestion,
    droppedSkills: [
      ...new Set([...previous.droppedSkills, ...next.droppedSkills]),
    ],
    ready: goalSkills.length > 0,
  };
}

export { intakeSchema };
