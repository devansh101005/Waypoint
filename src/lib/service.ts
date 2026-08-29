import { computeGap, gapCard } from "./gap";
import { applyCompletion, applyStruggle, buildMastery } from "./mastery";
import { planPath, type PlannedItem } from "./planner";
import { scoreResource } from "./scoring";
import { embedQuery, resourceCard } from "./embeddings";
import { cosine } from "./embeddings";
import { env } from "./env";
import type { Store, StoredLearner, StoredPath } from "./store";
import type {
  Gap,
  MasteryVector,
  PathDiff,
  ScoreBreakdown,
  SkillRef,
} from "./types";

/**
 * The application use-cases, sitting between the HTTP routes and the model.
 * Routes do request/response; this decides what happens.
 */

export interface GeneratePathResult {
  path: StoredPath;
  gap: Gap;
  diff: PathDiff | null;
}

/**
 * Score the corpus for this learner's gap, then plan over it.
 *
 * Dense similarity is used when embeddings are configured, and simply omitted
 * otherwise — the scorer renormalises, so retrieval degrades in quality rather
 * than breaking.
 */
export async function generatePath(
  store: Store,
  learner: StoredLearner,
  options: {
    supersedes?: string | null;
    excludeResourceIds?: string[];
    diffContext?: DiffContext;
  } = {},
): Promise<GeneratePathResult> {
  const graph = await store.graph();
  const resources = await store.resources();

  const gap = computeGap(learner.goalSkills, learner.mastery, graph);
  const card = gapCard(gap, graph, {
    goalText: learner.goalText,
    hoursPerWeek: learner.constraints.hoursPerWeek,
    formats: learner.constraints.formats,
  });

  /**
   * Dense similarity, when we can get it. Stored vectors are used in
   * preference to embedding the corpus again: with a database that turns an
   * N-document embedding call per request into a single query-embedding call.
   */
  let dense: Map<string, number> | null = null;
  if (env.hasCohere && resources.length > 0) {
    const query = await embedQuery(card);
    if (query) {
      let vectors = await store.resourceEmbeddings();
      if (!vectors) {
        const computed = await embedCorpus(resources.map(resourceCard));
        if (computed) {
          vectors = new Map(resources.map((r, i) => [r.id, computed[i]]));
        }
      }
      if (vectors) {
        dense = new Map(
          resources.map((r) => {
            const vector = vectors.get(r.id);
            return [r.id, vector ? cosine(query, vector) : 0];
          }),
        );
      }
    }
  }

  const scores = new Map<string, ScoreBreakdown>(
    resources.map((r) => [
      r.id,
      scoreResource(r, gap, dense ? { dense: dense.get(r.id) ?? 0 } : {}),
    ]),
  );

  const hourBudget = budgetFor(learner);
  const result = planPath({
    goalSkills: learner.goalSkills,
    mastery: learner.mastery,
    graph,
    resources,
    scores,
    hourBudget,
    maxItems: 12,
    excludeResourceIds: options.excludeResourceIds ?? [],
  });

  const previous = options.supersedes
    ? await store.getPath(options.supersedes)
    : null;

  const saved = await store.savePath({
    learnerId: learner.id,
    goalSkills: learner.goalSkills,
    items: result.items,
    totalHours: result.totalHours,
    complete: result.complete,
    supersedes: options.supersedes ?? null,
  });

  return {
    path: saved,
    gap,
    diff: previous ? diffPaths(previous, saved, options.diffContext) : null,
  };
}

/** Hours available before the deadline, if the learner gave us both numbers. */
function budgetFor(learner: StoredLearner): number | undefined {
  const { hoursPerWeek, deadlineWeeks } = learner.constraints;
  if (hoursPerWeek && deadlineWeeks) return hoursPerWeek * deadlineWeeks;
  return undefined;
}

async function embedCorpus(cards: string[]): Promise<number[][] | null> {
  const { embedDocuments } = await import("./embeddings");
  return embedDocuments(cards);
}

/**
 * Record feedback, move the learner's mastery, and replan from the new state.
 * The old path is kept and linked, which is what makes the change explainable.
 */
export async function applyFeedback(
  store: Store,
  learner: StoredLearner,
  input: {
    pathId: string;
    resourceId: string;
    event: "done" | "struggled" | "skipped";
  },
): Promise<GeneratePathResult> {
  const resource = await store.resource(input.resourceId);
  if (!resource) throw new Error(`Unknown resource: ${input.resourceId}`);

  const path = await store.getPath(input.pathId);
  const index = path?.items.findIndex((i) => i.resource.id === input.resourceId) ?? -1;

  let mastery: MasteryVector = learner.mastery;

  /**
   * Reaching step N means working through the steps before it. Without this the
   * learner's state never reflects their progress, so feedback on step 4 is
   * evaluated against a beginner's mastery and the replan changes nothing.
   */
  if (path && index > 0) {
    for (const prior of path.items.slice(0, index)) {
      mastery = applyCompletion(mastery, prior.resource);
    }
  }

  if (input.event === "done") mastery = applyCompletion(mastery, resource);
  else if (input.event === "struggled") mastery = applyStruggle(mastery, resource);

  await store.addEvent({
    learnerId: learner.id,
    type: input.event,
    payload: { resourceId: input.resourceId, pathId: input.pathId },
  });

  /**
   * A course the learner could not follow should not be prescribed again — the
   * replan routes around it to a different resource for the same skill.
   */
  const history = await store.events(learner.id);
  const excludeResourceIds = history
    .filter((e) => e.type === "struggled" || e.type === "skipped")
    .map((e) => String((e.payload as { resourceId?: string }).resourceId ?? ""))
    .filter(Boolean);

  const completedIds =
    path && index > 0 ? path.items.slice(0, index).map((i) => i.resource.id) : [];
  if (input.event === "done") completedIds.push(input.resourceId);

  const updated = await store.updateLearner(learner.id, { mastery });
  return generatePath(store, updated, {
    supersedes: input.pathId,
    excludeResourceIds,
    diffContext: {
      completedIds,
      replacedId: input.event === "done" ? null : input.resourceId,
    },
  });
}

/**
 * What changed between two paths, phrased so the learner can see why. This is
 * the visible half of adaptation — a replan nobody can see is indistinguishable
 * from nothing happening.
 */
export interface DiffContext {
  /** Steps the learner is now credited with finishing. */
  completedIds?: string[];
  /** The step the learner could not follow. */
  replacedId?: string | null;
}

export function diffPaths(
  previous: StoredPath,
  next: StoredPath,
  context: DiffContext = {},
): PathDiff {
  const before = new Map(
    previous.items.map((i, index) => [i.resource.id, index]),
  );
  const after = new Map(next.items.map((i, index) => [i.resource.id, index]));
  const completedIds = new Set(context.completedIds ?? []);
  const replacedId = context.replacedId ?? null;

  const added = next.items
    .filter((i) => !before.has(i.resource.id))
    .map((i) => ({
      resourceId: i.resource.id,
      title: i.resource.title,
      position: after.get(i.resource.id)! + 1,
      why: primaryReason(i),
    }));

  const gone = previous.items.filter((i) => !after.has(i.resource.id));

  /**
   * A step can leave the path for three different reasons and the learner
   * deserves to know which. Reporting a course they just finished as "dropped"
   * reads as the plan losing their work.
   */
  const completed = gone
    .filter((i) => completedIds.has(i.resource.id))
    .map((i) => ({ resourceId: i.resource.id, title: i.resource.title }));

  const replaced = gone
    .filter((i) => i.resource.id === replacedId && !completedIds.has(i.resource.id))
    .map((i) => ({ resourceId: i.resource.id, title: i.resource.title }));

  const removed = gone
    .filter((i) => !completedIds.has(i.resource.id) && i.resource.id !== replacedId)
    .map((i) => ({ resourceId: i.resource.id, title: i.resource.title }));

  const moved = next.items
    .filter((i) => before.has(i.resource.id))
    .map((i) => ({
      resourceId: i.resource.id,
      title: i.resource.title,
      from: before.get(i.resource.id)! + 1,
      to: after.get(i.resource.id)! + 1,
    }))
    .filter((m) => m.from !== m.to);

  return {
    added,
    completed,
    replaced,
    removed,
    moved,
    summary: summarise({ added, completed, replaced, removed, moved }),
  };
}

function primaryReason(item: PlannedItem): string {
  const covers = item.reasons.coversGapSkills;
  if (covers.length === 0) return "fills a gap in your plan";
  return `builds ${covers.map((c) => c.name).join(" and ")}`;
}

function summarise(diff: Omit<PathDiff, "summary">): string {
  const parts: string[] = [];

  if (diff.completed.length === 1) parts.push(`marked ${diff.completed[0].title} complete`);
  else if (diff.completed.length > 1) parts.push(`marked ${diff.completed.length} steps complete`);

  if (diff.replaced.length === 1) parts.push(`swapped out ${diff.replaced[0].title}`);

  if (diff.added.length === 1) parts.push(`added ${diff.added[0].title}`);
  else if (diff.added.length > 1) parts.push(`added ${diff.added.length} steps`);

  if (diff.removed.length === 1) parts.push(`dropped ${diff.removed[0].title}`);
  else if (diff.removed.length > 1) parts.push(`dropped ${diff.removed.length} steps`);

  if (diff.moved.length === 1) parts.push(`moved ${diff.moved[0].title}`);
  else if (diff.moved.length > 1) parts.push(`reordered ${diff.moved.length} steps`);

  if (parts.length === 0) return "Your path is unchanged.";
  return `${parts.join(", ").replace(/^./, (c) => c.toUpperCase())}.`;
}

/** Fresh learner state from a completed intake. */
export function masteryFromIntake(statedSkills: SkillRef[]): MasteryVector {
  return buildMastery({ stated: statedSkills });
}
