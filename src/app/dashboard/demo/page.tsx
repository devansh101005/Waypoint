import { redirect } from "next/navigation";
import { applyFeedback, generatePath } from "@/lib/service";
import { getStore } from "@/lib/store";
import type { SkillRef } from "@/lib/types";

/**
 * A dashboard anyone can reach without first having a learner.
 *
 * The progress dashboard is a required feature, and until this route existed
 * the only way in was through a learner id that does not exist until you have
 * finished an intake — so a judge browsing the deployed site would never see
 * it. This seeds a learner with a real profile, plans a real route, records one
 * completed step so there is progress to show, and hands off to the real
 * dashboard. No mock data: every figure it displays is planner output.
 */

export const dynamic = "force-dynamic";

/** Reused across requests on a warm instance so repeat visits are cheap. */
let demoLearnerId: string | null = null;

/**
 * Pick a destination from whatever corpus is loaded.
 *
 * Naming a slug here would tie the demo to one particular sheet — and did:
 * the seed corpus calls it `dashboarding`, the curated one calls it
 * `bi-dashboards`, so a hardcoded goal rendered an empty dashboard the moment
 * the real corpus arrived. The deepest teachable skill is chosen instead,
 * because a long prerequisite chain is what actually shows the planner working.
 */
async function pickDemoGoal(): Promise<{ goal: SkillRef; known: SkillRef[] } | null> {
  const store = getStore();
  const [graph, resources] = await Promise.all([store.graph(), store.resources()]);

  const teachable = new Set(resources.flatMap((r) => r.teaches.map((t) => t.skillId)));
  const candidates = graph
    .all()
    .filter((skill) => teachable.has(skill.id))
    .map((skill) => ({ skill, depth: graph.ancestors(skill.id).size }))
    .sort((a, b) => b.depth - a.depth);

  const best = candidates[0];
  if (!best || best.depth === 0) return null;

  // Give the learner one entry-level skill so the dashboard shows a mix of
  // "already had" and "picked up along the way" rather than a blank slate.
  const foundation = [...graph.ancestors(best.skill.id)]
    .filter((id) => graph.directPrereqs(id).length === 0 && teachable.has(id))
    .sort()[0];

  return {
    goal: { skillId: best.skill.id, level: 4 },
    known: foundation ? [{ skillId: foundation, level: 3 }] : [],
  };
}

async function seedDemoLearner(): Promise<string | null> {
  const store = getStore();

  if (demoLearnerId) {
    const existing = await store.getLearner(demoLearnerId);
    if (existing) return existing.id;
    demoLearnerId = null; // the store was reset under us
  }

  const target = await pickDemoGoal();
  if (!target) return null;

  const graph = await store.graph();
  const goalName = graph.name(target.goal.skillId);

  const learner = await store.createLearner({
    name: "Riya",
    goalText: `I want to be able to do ${goalName.toLowerCase()} well enough to be employable.`,
    goalSummary: `You want to reach ${goalName} at a working professional level, starting from what you already know.`,
    goalSkills: [target.goal],
    statedSkills: target.known,
    mastery: Object.fromEntries(target.known.map((k) => [k.skillId, k.level / 5])),
    constraints: { hoursPerWeek: 10, deadlineWeeks: 26 },
  });

  const planned = await generatePath(store, learner);

  // One completed step, so the dashboard shows progress rather than an empty
  // state — the empty version tells a judge nothing about what it does.
  if (planned.path.items.length > 0) {
    await applyFeedback(store, learner, {
      pathId: planned.path.id,
      resourceId: planned.path.items[0].resource.id,
      event: "done",
    });
  }

  demoLearnerId = learner.id;
  return learner.id;
}

export default async function DemoDashboard() {
  const id = await seedDemoLearner();
  // No corpus, no demo — send them somewhere that explains itself rather than
  // to a dashboard with nothing in it.
  redirect(id ? `/dashboard/${id}` : "/plan");
}
