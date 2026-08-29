import { NextResponse } from "next/server";
import { z } from "zod";
import { extractIntake, mergeIntake, type IntakeResult } from "@/lib/intake";
import type { ChatMessage } from "@/lib/llm";
import { masteryFromIntake } from "@/lib/service";
import { getStore } from "@/lib/store";

const bodySchema = z.object({
  learnerId: z.uuid().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(30),
});

/**
 * Read the conversation so far and update the learner's profile from it.
 * Returns the profile rather than prose: the UI renders the panel, and the
 * assistant's reply is whatever question is still outstanding.
 */
export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "invalid_request", detail: describe(error) },
      { status: 400 },
    );
  }

  const store = getStore();
  const graph = await store.graph();

  let extracted: IntakeResult;
  try {
    extracted = await extractIntake(body.messages as ChatMessage[], graph);
  } catch (error) {
    // The gateway being down must not lose the learner's message.
    return NextResponse.json(
      {
        error: "extraction_failed",
        detail: describe(error),
        hint: "Check RIKKO_API_KEY and LLM_BASE_URL in .env.local.",
      },
      { status: 502 },
    );
  }

  const existing = body.learnerId
    ? await store.getLearner(body.learnerId)
    : null;
  const previous: IntakeResult | null = existing
    ? {
        goalSkills: existing.goalSkills,
        statedSkills: existing.statedSkills,
        constraints: existing.constraints,
        goalSummary: existing.goalSummary,
        followUpQuestion: null,
        droppedSkills: [],
        ready: existing.goalSkills.length > 0,
      }
    : null;

  const profile = mergeIntake(previous, extracted);
  const lastUserMessage = [...body.messages]
    .reverse()
    .find((m) => m.role === "user");

  const learner = existing
    ? await store.updateLearner(existing.id, {
        goalText: lastUserMessage?.content ?? existing.goalText,
        goalSummary: profile.goalSummary,
        constraints: profile.constraints,
        goalSkills: profile.goalSkills,
        statedSkills: profile.statedSkills,
        mastery: masteryFromIntake(profile.statedSkills),
      })
    : await store.createLearner({
        goalText: lastUserMessage?.content ?? "",
        goalSummary: profile.goalSummary,
        constraints: profile.constraints,
        goalSkills: profile.goalSkills,
        statedSkills: profile.statedSkills,
        mastery: masteryFromIntake(profile.statedSkills),
      });

  return NextResponse.json({
    learnerId: learner.id,
    profile: {
      goalSummary: profile.goalSummary,
      goalSkills: profile.goalSkills.map((g) => ({
        skillId: g.skillId,
        name: graph.name(g.skillId),
        level: g.level,
      })),
      statedSkills: profile.statedSkills.map((s) => ({
        skillId: s.skillId,
        name: graph.name(s.skillId),
        level: s.level,
      })),
      constraints: profile.constraints,
    },
    followUpQuestion: profile.followUpQuestion,
    ready: profile.ready,
    droppedSkills: profile.droppedSkills,
  });
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
