import { describe, expect, it } from "vitest";
import { findPrereqViolations } from "./planner";
import { applyFeedback, diffPaths, generatePath } from "./service";
import { createMemoryStore, type Store, type StoredLearner } from "./store";
import { serialiseProgress } from "./serialise";

/**
 * These run against the real bootstrap corpus rather than fixtures: the
 * behaviours here (does feedback change anything? does the path stay feasible?)
 * only mean something over a corpus with real coverage gaps in it.
 */

async function setup(): Promise<{ store: Store; learner: StoredLearner }> {
  const store = createMemoryStore();
  const learner = await store.createLearner({
    name: "Test learner",
    goalText: "I want to build dashboards",
    goalSkills: [{ skillId: "dashboarding", level: 4 }],
    statedSkills: [{ skillId: "sql-basics", level: 3 }],
    mastery: { "sql-basics": 0.6 },
  });
  return { store, learner };
}

describe("generatePath", () => {
  it("plans a feasible, complete path over the real corpus", async () => {
    const { store, learner } = await setup();
    const { path } = await generatePath(store, learner);

    expect(path.items.length).toBeGreaterThan(3);
    expect(path.complete).toBe(true);
    expect(findPrereqViolations(path.items, learner.mastery)).toEqual([]);
  });

  it("does not reteach a skill the learner arrived with", async () => {
    const { store, learner } = await setup();
    const { path } = await generatePath(store, learner);
    // SQLBolt teaches only sql-basics, which this learner already has.
    expect(path.items.map((i) => i.resource.id)).not.toContain("RES-008");
  });

  it("records the path against the learner and exposes it as active", async () => {
    const { store, learner } = await setup();
    const { path } = await generatePath(store, learner);
    expect(await store.activePath(learner.id)).toMatchObject({ id: path.id });
  });

  it("respects an hour budget derived from the learner's constraints", async () => {
    const store = createMemoryStore();
    const learner = await store.createLearner({
      goalSkills: [{ skillId: "dashboarding", level: 4 }],
      constraints: { hoursPerWeek: 2, deadlineWeeks: 10 }, // 20 hours
    });
    const { path } = await generatePath(store, learner);
    expect(path.totalHours).toBeLessThanOrEqual(20);
    expect(path.complete).toBe(false);
  });
});

describe("applyFeedback", () => {
  it("changes the path when the learner struggles", async () => {
    const { store, learner } = await setup();
    const first = await generatePath(store, learner);
    const target = first.path.items[1];

    const after = await applyFeedback(store, learner, {
      pathId: first.path.id,
      resourceId: target.resource.id,
      event: "struggled",
    });

    const before = first.path.items.map((i) => i.resource.id);
    const now = after.path.items.map((i) => i.resource.id);
    expect(now).not.toEqual(before);
    expect(after.diff).not.toBeNull();
    expect(after.diff!.summary).not.toBe("Your path is unchanged.");
  });

  it("does not prescribe a resource the learner already struggled with", async () => {
    const { store, learner } = await setup();
    const first = await generatePath(store, learner);
    const target = first.path.items[1];

    const after = await applyFeedback(store, learner, {
      pathId: first.path.id,
      resourceId: target.resource.id,
      event: "struggled",
    });
    expect(after.path.items.map((i) => i.resource.id)).not.toContain(
      target.resource.id,
    );
  });

  it("credits the steps before the one being reported on", async () => {
    const { store, learner } = await setup();
    const first = await generatePath(store, learner);
    const third = first.path.items[2];

    await applyFeedback(store, learner, {
      pathId: first.path.id,
      resourceId: third.resource.id,
      event: "done",
    });

    // Reaching step 3 implies the first two were worked through, so their
    // taught skills must now show up in the learner's mastery.
    const updated = await store.getLearner(learner.id);
    const earlierSkills = first.path.items
      .slice(0, 2)
      .flatMap((i) => i.resource.teaches.map((t) => t.skillId));
    for (const skillId of earlierSkills) {
      expect(updated!.mastery[skillId] ?? 0).toBeGreaterThan(0);
    }
  });

  it("keeps the replanned path feasible from the learner's new state", async () => {
    const { store, learner } = await setup();
    const first = await generatePath(store, learner);
    const after = await applyFeedback(store, learner, {
      pathId: first.path.id,
      resourceId: first.path.items[1].resource.id,
      event: "struggled",
    });
    const updated = await store.getLearner(learner.id);
    expect(findPrereqViolations(after.path.items, updated!.mastery)).toEqual(
      [],
    );
  });

  it("links the new path to the one it replaces", async () => {
    const { store, learner } = await setup();
    const first = await generatePath(store, learner);
    const after = await applyFeedback(store, learner, {
      pathId: first.path.id,
      resourceId: first.path.items[0].resource.id,
      event: "done",
    });
    expect(after.path.supersedes).toBe(first.path.id);
    expect(await store.activePath(learner.id)).toMatchObject({
      id: after.path.id,
    });
  });

  it("never describes a step the learner walked past as dropped", async () => {
    const { store, learner } = await setup();
    const first = await generatePath(store, learner);
    const second = first.path.items[1];

    const after = await applyFeedback(store, learner, {
      pathId: first.path.id,
      resourceId: second.resource.id,
      event: "struggled",
    });

    // The step before the one they struggled with was worked through. It may
    // legitimately reappear as remediation, but it must never be reported as
    // something the plan threw away.
    const firstStepId = first.path.items[0].resource.id;
    expect(after.diff!.removed.map((r) => r.resourceId)).not.toContain(firstStepId);
    expect(after.diff!.replaced.map((r) => r.resourceId)).toContain(second.resource.id);
    expect(after.diff!.summary).toContain("Swapped out");
  });

  it("reports a finished step that leaves the path as completed", async () => {
    const { store, learner } = await setup();
    const first = await generatePath(store, learner);
    const firstStep = first.path.items[0];

    const after = await applyFeedback(store, learner, {
      pathId: first.path.id,
      resourceId: firstStep.resource.id,
      event: "done",
    });

    const stillThere = after.path.items.some((i) => i.resource.id === firstStep.resource.id);
    expect(stillThere).toBe(false);
    expect(after.diff!.completed.map((c) => c.resourceId)).toContain(firstStep.resource.id);
    expect(after.diff!.removed.map((r) => r.resourceId)).not.toContain(firstStep.resource.id);
  });

  it("logs every event for the audit trail", async () => {
    const { store, learner } = await setup();
    const first = await generatePath(store, learner);
    await applyFeedback(store, learner, {
      pathId: first.path.id,
      resourceId: first.path.items[0].resource.id,
      event: "done",
    });
    const events = await store.events(learner.id);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("done");
  });

  it("rejects an unknown resource rather than silently replanning", async () => {
    const { store, learner } = await setup();
    const first = await generatePath(store, learner);
    await expect(
      applyFeedback(store, learner, {
        pathId: first.path.id,
        resourceId: "RES-999",
        event: "done",
      }),
    ).rejects.toThrow(/Unknown resource/);
  });
});

describe("diffPaths", () => {
  const item = (id: string, title: string) => ({
    resource: {
      id,
      title,
      url: "",
      provider: "",
      type: "course" as const,
      description: "",
      difficulty: 2,
      estHours: 5,
      quality: 3,
      teaches: [],
      requires: [],
    },
    reasons: {
      coversGapSkills: [
        { skillId: "s", name: "Skill", fromLevel: 0, toLevel: 3 },
      ],
      unlockedBy: [],
      unlocks: [],
      difficultyFit: {
        resourceDifficulty: 2,
        learnerLevel: 1,
        verdict: "aligned" as const,
      },
      estHours: 5,
      milestoneContribution: null,
      scoreBreakdown: {
        tag: 0,
        dense: 0,
        lexical: 0,
        qualityPrior: 1,
        total: 0,
      },
    },
    milestoneLabel: null,
  });

  const base = {
    id: "p1",
    learnerId: "l1",
    goalSkills: [],
    totalHours: 10,
    complete: true,
    supersedes: null,
    createdAt: "2026-08-29T00:00:00.000Z",
  };

  it("reports an unchanged path plainly", () => {
    const path = { ...base, items: [item("A", "A")] };
    expect(diffPaths(path, { ...path, id: "p2" }).summary).toBe(
      "Your path is unchanged.",
    );
  });

  it("names an inserted step and why it is there", () => {
    const before = { ...base, items: [item("A", "A")] };
    const after = {
      ...base,
      id: "p2",
      items: [item("A", "A"), item("B", "Remedial B")],
    };
    const diff = diffPaths(before, after);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].title).toBe("Remedial B");
    expect(diff.added[0].why).toContain("Skill");
    expect(diff.summary).toContain("Remedial B");
  });

  it("detects a dropped step", () => {
    const before = { ...base, items: [item("A", "A"), item("B", "B")] };
    const after = { ...base, id: "p2", items: [item("A", "A")] };
    expect(diffPaths(before, after).removed.map((r) => r.resourceId)).toEqual([
      "B",
    ]);
  });

  it("reports a finished step as completed, not dropped", () => {
    const before = { ...base, items: [item("A", "A"), item("B", "B")] };
    const after = { ...base, id: "p2", items: [item("B", "B")] };
    const diff = diffPaths(before, after, { completedIds: ["A"] });
    expect(diff.completed.map((c) => c.resourceId)).toEqual(["A"]);
    expect(diff.removed).toEqual([]);
    expect(diff.summary).toContain("complete");
    expect(diff.summary).not.toContain("Dropped");
  });

  it("reports a struggled step as swapped out, not dropped", () => {
    const before = { ...base, items: [item("A", "A"), item("B", "B")] };
    const after = { ...base, id: "p2", items: [item("A", "A")] };
    const diff = diffPaths(before, after, { replacedId: "B" });
    expect(diff.replaced.map((r) => r.resourceId)).toEqual(["B"]);
    expect(diff.removed).toEqual([]);
    expect(diff.summary).toContain("Swapped out");
  });

  it("still reports a genuinely superseded step as dropped", () => {
    const before = { ...base, items: [item("A", "A"), item("B", "B")] };
    const after = { ...base, id: "p2", items: [item("A", "A")] };
    const diff = diffPaths(before, after, { completedIds: [], replacedId: null });
    expect(diff.removed.map((r) => r.resourceId)).toEqual(["B"]);
    expect(diff.completed).toEqual([]);
  });

  it("detects reordering with positions", () => {
    const before = { ...base, items: [item("A", "A"), item("B", "B")] };
    const after = {
      ...base,
      id: "p2",
      items: [item("B", "B"), item("A", "A")],
    };
    const moved = diffPaths(before, after).moved;
    expect(moved).toHaveLength(2);
    expect(moved.find((m) => m.resourceId === "B")).toMatchObject({
      from: 2,
      to: 1,
    });
  });
});

describe("serialiseProgress", () => {
  it("summarises mastery, milestones and the next action", async () => {
    const { store, learner } = await setup();
    const { path } = await generatePath(store, learner);
    const graph = await store.graph();
    const updated = await store.getLearner(learner.id);

    const progress = serialiseProgress(updated!, path, graph);
    expect(progress.totalSteps).toBe(path.items.length);
    expect(progress.nextAction?.position).toBe(1);
    expect(progress.skills.some((s) => s.isGoal)).toBe(true);
    expect(progress.milestones.length).toBeGreaterThan(0);
  });

  it("handles a learner with no path yet", async () => {
    const { store, learner } = await setup();
    const graph = await store.graph();
    const progress = serialiseProgress(learner, null, graph);
    expect(progress.totalSteps).toBe(0);
    expect(progress.nextAction).toBeNull();
  });
});
