import { complete, type ChatMessage, type ModelRole } from "./llm";
import type { SkillGraph } from "./graph";
import type { StoredPath } from "./store";

/**
 * Answering a learner's questions about their own plan.
 *
 * The model is given the plan — the steps, what each covers, what it depends on
 * — and nothing else. It is not a search engine over the catalogue and it is
 * not a general tutor: if the answer is not derivable from the plan it is told
 * to say so. That keeps every answer checkable against something on screen.
 */

const SYSTEM = `You answer a learner's questions about the study plan below.

Rules:
- Answer ONLY from the plan. It contains every step, what each one teaches, what
  it depends on, and how long it takes.
- If the question cannot be answered from the plan, say plainly that the plan
  does not cover it, and suggest what they could ask instead.
- Never invent a course, resource, skill or claim that is not in the plan.
- Ordering questions ("why is X before Y?") are answered from the dependency
  information given: name the skill that connects them.
- Two to four sentences. Warm and direct, second person, no markdown.`;

export interface AskOptions {
  role?: ModelRole;
  completion?: (
    messages: ChatMessage[],
    opts?: { role?: ModelRole },
  ) => Promise<string>;
}

/** A compact, complete description of the plan for the model to reason over. */
export function describePlan(path: StoredPath, graph: SkillGraph): string {
  const lines = path.items.map((item, index) => {
    const covers = item.reasons.coversGapSkills
      .map((c) => `${c.name} (level ${c.fromLevel} to ${c.toLevel})`)
      .join(", ");
    const after = item.reasons.unlockedBy
      .map((u) => `${u.title} for ${graph.name(u.skillId)}`)
      .join("; ");
    const opens = item.reasons.unlocks.map((u) => u.name).join(", ");

    return [
      `Step ${index + 1}: ${item.resource.title} (${item.resource.provider || item.resource.type}, ${item.resource.estHours}h, difficulty ${item.resource.difficulty}/5)`,
      covers ? `  teaches: ${covers}` : null,
      after ? `  depends on earlier steps: ${after}` : null,
      opens ? `  makes possible: ${opens}` : null,
      item.milestoneLabel ? `  ${item.milestoneLabel}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const total = path.items.reduce((sum, i) => sum + i.resource.estHours, 0);
  return [
    `The plan has ${path.items.length} steps and about ${total} hours of study.`,
    path.complete
      ? "It reaches the learner's goal."
      : "It is a first phase toward the goal.",
    "",
    ...lines,
  ].join("\n");
}

export async function askAboutPlan(
  question: string,
  path: StoredPath,
  graph: SkillGraph,
  options: AskOptions = {},
): Promise<{ answer: string; grounded: boolean }> {
  const call = options.completion ?? ((m, o) => complete(m, o));

  const answer = await call(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `${describePlan(path, graph)}\n\nQuestion: ${question}`,
      },
    ],
    { role: options.role ?? "primary" },
  );

  const text = answer.trim();
  return { answer: text, grounded: mentionsOnlyPlanContent(text, path, graph) };
}

/**
 * Does the answer stay inside the plan? Reported rather than enforced: unlike a
 * step explanation, a legitimate answer may name a skill that is on the plan
 * but not on the step being discussed, so a hard reject would be wrong here.
 */
export function mentionsOnlyPlanContent(
  answer: string,
  path: StoredPath,
  graph: SkillGraph,
): boolean {
  const lower = answer.toLowerCase();

  const permitted = new Set<string>();
  for (const item of path.items) {
    permitted.add(item.resource.title.toLowerCase());
    for (const c of item.reasons.coversGapSkills)
      permitted.add(c.name.toLowerCase());
    for (const u of item.reasons.unlocks) permitted.add(u.name.toLowerCase());
  }

  for (const skill of graph.all()) {
    const name = skill.name.toLowerCase();
    if (permitted.has(name)) continue;
    if (new RegExp(`\\b${escapeRegex(name)}\\b`, "i").test(lower)) return false;
  }
  return true;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
