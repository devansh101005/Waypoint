import { NextResponse } from "next/server";
import { serialiseProgress } from "@/lib/serialise";
import { getStore } from "@/lib/store";

/**
 * Everything the dashboard needs about one learner: mastery per skill, the
 * active route, milestones, and what to do next.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const store = getStore();
  const learner = await store.getLearner(id);
  if (!learner) {
    return NextResponse.json({ error: "unknown_learner" }, { status: 404 });
  }

  const graph = await store.graph();
  const path = await store.activePath(id);
  const events = await store.events(id);

  return NextResponse.json({
    ...serialiseProgress(learner, path, graph),
    pathId: path?.id ?? null,
    complete: path?.complete ?? false,
    activity: events
      .slice(-10)
      .reverse()
      .map((event) => ({
        type: event.type,
        resourceId:
          (event.payload as { resourceId?: string }).resourceId ?? null,
        at: event.ts,
      })),
  });
}
