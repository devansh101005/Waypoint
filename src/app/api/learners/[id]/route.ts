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

  /**
   * An id that is not a UUID cannot name a learner, and handing it to Postgres
   * raises a cast error rather than returning nothing — so a mistyped URL came
   * back as a 500. Both "malformed" and "no such learner" are the same thing to
   * whoever is reading: this route does not exist.
   */
  let learner = null;
  try {
    learner = await store.getLearner(id);
  } catch {
    learner = null;
  }
  if (!learner) {
    return NextResponse.json({ error: "unknown_learner" }, { status: 404 });
  }

  const graph = await store.graph();
  const path = await store.activePath(id);
  const events = await store.events(id);

  // The activity feed is for the learner, so it has to name the thing they
  // actually did. An internal id tells them nothing.
  const resources = await store.resources();
  const titleOf = new Map(resources.map((r) => [r.id, r.title]));

  return NextResponse.json({
    ...serialiseProgress(learner, path, graph),
    pathId: path?.id ?? null,
    complete: path?.complete ?? false,
    activity: events
      .slice(-10)
      .reverse()
      .map((event) => {
        const resourceId =
          (event.payload as { resourceId?: string }).resourceId ?? null;
        return {
          type: event.type,
          resourceId,
          resourceTitle: resourceId ? (titleOf.get(resourceId) ?? null) : null,
          at: event.ts,
        };
      }),
  });
}
