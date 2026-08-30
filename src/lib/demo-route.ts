import { serialisePathItems } from "./serialise";
import { applyFeedback, generatePath } from "./service";
import { getStore } from "./store";
import type { RouteStop } from "@/components/transit/route";

/**
 * The worked example shown on the landing page.
 *
 * Both the original route and the one after a setback are produced by the real
 * planner against the live corpus, so the figures on the front page cannot
 * drift from what the product actually does. A hand-written example would be
 * indistinguishable to a reader and worth nothing the moment the corpus changed.
 */

export interface DemoRouteData {
  learner: string;
  before: RouteStop[];
  after: RouteStop[];
  struggledWith: string;
  diffSummary: string;
  addedIds: string[];
}

export async function buildDemoRoute(): Promise<DemoRouteData | null> {
  const store = getStore();
  const [graph, resources] = await Promise.all([store.graph(), store.resources()]);

  // The deepest goal the corpus can actually deliver makes the longest, most
  // illustrative route — and avoids opening on one the planner has to refuse.
  const ceiling = new Map<string, number>();
  for (const r of resources) {
    for (const t of r.teaches) {
      ceiling.set(t.skillId, Math.max(ceiling.get(t.skillId) ?? 0, t.level));
    }
  }

  const destination = graph
    .all()
    .filter((s) => (ceiling.get(s.id) ?? 0) >= 4)
    .sort((a, b) => graph.ancestors(b.id).size - graph.ancestors(a.id).size)[0];
  if (!destination) return null;

  try {
    const learner = await store.createLearner({
      name: "Landing example",
      goalText: `I want to reach ${destination.name}`,
      goalSkills: [{ skillId: destination.id, level: 4 }],
    });

    const first = await generatePath(store, learner);
    if (first.path.items.length < 3) return null;

    // Report a setback partway in, where a replan is most informative.
    const target = first.path.items[Math.min(2, first.path.items.length - 1)];
    const replanned = await applyFeedback(store, learner, {
      pathId: first.path.id,
      resourceId: target.resource.id,
      event: "struggled",
    });

    return {
      learner: `Starting from nothing, aiming at ${destination.name} at a working professional level.`,
      before: serialisePathItems(first.path),
      after: serialisePathItems(replanned.path),
      struggledWith: target.resource.title,
      diffSummary: replanned.diff?.summary ?? "The route was re-planned.",
      addedIds: replanned.diff?.added.map((a) => a.resourceId) ?? [],
    };
  } catch {
    // The landing page must render even if planning fails.
    return null;
  }
}
