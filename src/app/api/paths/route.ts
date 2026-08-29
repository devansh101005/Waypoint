import { NextResponse } from "next/server";
import { z } from "zod";
import { generatePath } from "@/lib/service";
import { getStore } from "@/lib/store";
import { serialisePath } from "@/lib/serialise";

const bodySchema = z.object({
  learnerId: z.uuid(),
  supersedes: z.uuid().nullable().optional(),
});

/** Generate a learning path for a learner whose profile is ready. */
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
  const learner = await store.getLearner(body.learnerId);
  if (!learner) {
    return NextResponse.json({ error: "unknown_learner" }, { status: 404 });
  }
  if (learner.goalSkills.length === 0) {
    return NextResponse.json(
      {
        error: "no_goal",
        detail:
          "This learner has no resolved goal skills yet — finish intake first.",
      },
      { status: 409 },
    );
  }

  try {
    const graph = await store.graph();
    const result = await generatePath(store, learner, {
      supersedes: body.supersedes ?? null,
    });
    return NextResponse.json(serialisePath(result, graph));
  } catch (error) {
    return NextResponse.json(
      { error: "planning_failed", detail: describe(error) },
      { status: 500 },
    );
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
