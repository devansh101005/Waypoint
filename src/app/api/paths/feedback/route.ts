import { NextResponse } from "next/server";
import { z } from "zod";
import { serialisePath } from "@/lib/serialise";
import { applyFeedback } from "@/lib/service";
import { getStore } from "@/lib/store";

const bodySchema = z.object({
  learnerId: z.uuid(),
  pathId: z.uuid(),
  resourceId: z.string().min(1),
  event: z.enum(["done", "struggled", "skipped"]),
});

/**
 * Record what happened with a step, then replan from the learner's new state.
 * The response carries the diff, because an adaptation nobody can see is
 * indistinguishable from nothing happening.
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
  const learner = await store.getLearner(body.learnerId);
  if (!learner)
    return NextResponse.json({ error: "unknown_learner" }, { status: 404 });

  const path = await store.getPath(body.pathId);
  if (!path)
    return NextResponse.json({ error: "unknown_path" }, { status: 404 });

  try {
    const graph = await store.graph();
    const result = await applyFeedback(store, learner, {
      pathId: body.pathId,
      resourceId: body.resourceId,
      event: body.event,
    });
    return NextResponse.json(serialisePath(result, graph));
  } catch (error) {
    return NextResponse.json(
      { error: "replan_failed", detail: describe(error) },
      { status: 500 },
    );
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
