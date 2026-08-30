import { config } from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";
import { createPostgresStore } from "./store-postgres";
import { generatePath, applyFeedback } from "./service";
import { findPrereqViolations } from "./planner";
import type { Store, StoredLearner } from "./store";

config({ path: ".env.local" });

/**
 * Integration tests against a real database.
 *
 * Skipped when DATABASE_URL is absent so the suite still passes on a clean
 * checkout — which is how anyone evaluating this project will first run it.
 * Every learner created here is left in place; the rows are tiny and deleting
 * them would hide exactly the persistence these tests exist to prove.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("postgres store", () => {
  let store: Store;
  let learner: StoredLearner;
  let goalSkillId: string;

  beforeAll(async () => {
    store = createPostgresStore();

    /**
     * The goal is chosen from whatever corpus the database currently holds
     * rather than named here. These tests run against a live database whose
     * contents change whenever someone imports a new sheet, and hardcoded
     * slugs turn a routine corpus update into a red suite.
     */
    const [graph, resources] = await Promise.all([store.graph(), store.resources()]);
    const teachable = new Set(resources.flatMap((r) => r.teaches.map((t) => t.skillId)));
    const deepest = graph
      .all()
      .filter((skill) => teachable.has(skill.id))
      .sort((a, b) => graph.ancestors(b.id).size - graph.ancestors(a.id).size)[0];

    const foundation = [...graph.ancestors(deepest.id)]
      .filter((id) => graph.directPrereqs(id).length === 0 && teachable.has(id))
      .sort()[0];

    goalSkillId = deepest.id;

    learner = await store.createLearner({
      name: "Integration test",
      goalText: `I want to reach ${deepest.name}`,
      goalSummary: `You want to reach ${deepest.name}.`,
      goalSkills: [{ skillId: deepest.id, level: 4 }],
      statedSkills: foundation ? [{ skillId: foundation, level: 3 }] : [],
      mastery: foundation ? { [foundation]: 0.6 } : {},
    });
  }, 60000);

  it("reports itself as the durable store", () => {
    expect(store.kind).toBe("postgres");
  });

  it("loads the corpus from the database", async () => {
    const graph = await store.graph();
    const resources = await store.resources();
    expect(graph.all().length).toBeGreaterThan(10);
    expect(resources.length).toBeGreaterThan(10);
    expect(resources[0].teaches.length).toBeGreaterThan(0);
  });

  it("exposes stored embeddings so the corpus is not re-embedded per request", async () => {
    const embeddings = await store.resourceEmbeddings();
    expect(embeddings).not.toBeNull();
    expect(embeddings!.size).toBeGreaterThan(0);
    expect([...embeddings!.values()][0].length).toBe(1536);
  });

  it("round-trips a learner including goal and mastery", async () => {
    const loaded = await store.getLearner(learner.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.goalSummary).toBe(learner.goalSummary);
    expect(loaded!.goalSkills).toEqual([{ skillId: goalSkillId, level: 4 }]);
    for (const stated of learner.statedSkills) {
      expect(loaded!.mastery[stated.skillId]).toBeCloseTo(0.6, 2);
    }
  });

  it("returns null for a learner that does not exist", async () => {
    expect(
      await store.getLearner("00000000-0000-0000-0000-000000000000"),
    ).toBeNull();
  });

  it("persists a generated path and serves it as the active one", async () => {
    const { path } = await generatePath(store, learner);
    expect(path.items.length).toBeGreaterThan(2);
    expect(findPrereqViolations(path.items, learner.mastery)).toEqual([]);

    const reloaded = await store.getPath(path.id);
    expect(reloaded!.items.map((i) => i.resource.id)).toEqual(
      path.items.map((i) => i.resource.id),
    );
    expect(reloaded!.items[0].reasons.coversGapSkills.length).toBeGreaterThan(
      0,
    );

    const active = await store.activePath(learner.id);
    expect(active!.id).toBe(path.id);
  }, 60000);

  it("supersedes the old path on feedback and keeps both", async () => {
    const first = await generatePath(store, learner);
    const after = await applyFeedback(store, learner, {
      pathId: first.path.id,
      resourceId: first.path.items[0].resource.id,
      event: "done",
    });

    expect(after.path.supersedes).toBe(first.path.id);
    expect((await store.activePath(learner.id))!.id).toBe(after.path.id);

    const history = await store.pathHistory(learner.id);
    expect(history.map((p) => p.id)).toContain(first.path.id);
    expect(history.map((p) => p.id)).toContain(after.path.id);
  }, 90000);

  it("records events in order", async () => {
    const events = await store.events(learner.id);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe("done");
    expect(events[0].payload).toHaveProperty("resourceId");
  });

  it("updates mastery without leaving stale skills behind", async () => {
    await store.updateLearner(learner.id, { mastery: { [goalSkillId]: 0.9 } });
    const reloaded = await store.getLearner(learner.id);
    expect(reloaded!.mastery[goalSkillId]).toBeCloseTo(0.9, 2);
    expect(Object.keys(reloaded!.mastery)).toEqual([goalSkillId]);
  }, 30000);
});
