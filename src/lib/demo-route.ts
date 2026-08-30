import { findPrereqViolations } from "./planner";
import { serialisePathItems } from "./serialise";
import { applyFeedback, generatePath } from "./service";
import { getStore } from "./store";
import type { MasteryVector } from "./types";
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
  /**
   * Measured on the route being shown, not asserted. The landing page states
   * both as facts about the planner, so they have to come from the planner —
   * if a corpus change ever made the goal unreachable, the page must say so.
   */
  beforeStats: RouteStats;
  afterStats: RouteStats;
}

export interface RouteStats {
  violations: number;
  reachesGoal: boolean;
}

export async function buildDemoRoute(): Promise<DemoRouteData | null> {
  const store = getStore();
  const [graph, resources] = await Promise.all([
    store.graph(),
    store.resources(),
  ]);

  // The deepest goal the corpus can actually deliver makes the longest, most
  // illustrative route — and avoids opening on one the planner has to refuse.
  const ceiling = new Map<string, number>();
  for (const r of resources) {
    for (const t of r.teaches) {
      ceiling.set(t.skillId, Math.max(ceiling.get(t.skillId) ?? 0, t.level));
    }
  }

  /**
   * Candidates, deepest first — a longer chain of prerequisites makes a more
   * illustrative route.
   *
   * Depth alone is not enough, though: the planner caps a path at 12 steps, and
   * the very deepest goals in a well-stocked corpus need more than that, so
   * they stop short with `complete: false`. The landing page should open on a
   * route that arrives. We take the deepest one that actually does, rather than
   * the deepest one that exists — and the page still reports the outcome it
   * measures, so if none of them completed it would say so.
   */
  const candidates = graph
    .all()
    .filter((s) => (ceiling.get(s.id) ?? 0) >= 4)
    .sort((a, b) => graph.ancestors(b.id).size - graph.ancestors(a.id).size)
    .slice(0, 8);
  if (candidates.length === 0) return null;

  try {
    let destination = candidates[0];
    let learner = await store.createLearner({
      name: "Landing example",
      goalText: `I want to reach ${destination.name}`,
      goalSkills: [{ skillId: destination.id, level: 4 }],
    });
    let first = await generatePath(store, learner);

    for (const candidate of candidates.slice(1)) {
      if (first.path.complete && first.path.items.length >= 3) break;
      destination = candidate;
      learner = await store.createLearner({
        name: "Landing example",
        goalText: `I want to reach ${destination.name}`,
        goalSkills: [{ skillId: destination.id, level: 4 }],
      });
      first = await generatePath(store, learner);
    }

    if (first.path.items.length < 3) return null;

    // Report a setback partway in, where a replan is most informative.
    const target = first.path.items[Math.min(2, first.path.items.length - 1)];
    const replanned = await applyFeedback(store, learner, {
      pathId: first.path.id,
      resourceId: target.resource.id,
      event: "struggled",
    });

    /**
     * Each route is checked against the mastery it was actually planned from.
     *
     * The first route starts from nothing. The replan does not: by then the
     * learner has walked the earlier stops, and those stops are no longer in
     * the route. Checking the replan against an empty vector counts the skills
     * they already earned as missing, and reports violations in a plan that has
     * none — which would contradict our own headline claim on our own page.
     */
    const afterLearner = await store.getLearner(learner.id);
    const statsFor = (
      path: typeof first.path,
      startMastery: MasteryVector,
    ): RouteStats => ({
      violations: findPrereqViolations(path.items, startMastery).length,
      reachesGoal: path.complete,
    });

    return {
      learner: `Starting from nothing, aiming at ${destination.name} at a working professional level.`,
      before: serialisePathItems(first.path),
      after: serialisePathItems(replanned.path),
      struggledWith: target.resource.title,
      diffSummary: replanned.diff?.summary ?? "The route was re-planned.",
      addedIds: replanned.diff?.added.map((a) => a.resourceId) ?? [],
      beforeStats: statsFor(first.path, {}),
      afterStats: statsFor(replanned.path, afterLearner?.mastery ?? {}),
    };
  } catch {
    // The landing page must render even if planning fails.
    return null;
  }
}
