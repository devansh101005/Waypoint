import type { SkillGraph } from "./graph";
import { masteryToLevel } from "./mastery";
import type { GeneratePathResult } from "./service";
import type { StoredLearner, StoredPath } from "./store";
import type { Gap } from "./types";

/**
 * Internal shapes to API shapes.
 *
 * The client never resolves a skill id to a name, and never recomputes a level
 * from a mastery number — that logic stays here so every surface (path view,
 * dashboard, diff) shows the same thing.
 */

export function serialiseGap(gap: Gap, graph: SkillGraph) {
  return gap.map((entry) => ({
    skillId: entry.skillId,
    name: graph.name(entry.skillId),
    currentLevel: round(masteryToLevel(entry.current)),
    targetLevel: round(masteryToLevel(entry.target)),
    weight: round(entry.weight),
    isGoal: entry.isGoal,
  }));
}

export function serialisePathItems(path: StoredPath) {
  return path.items.map((item, index) => ({
    position: index + 1,
    resource: {
      id: item.resource.id,
      title: item.resource.title,
      url: item.resource.url,
      provider: item.resource.provider,
      type: item.resource.type,
      description: item.resource.description,
      difficulty: item.resource.difficulty,
      estHours: item.resource.estHours,
    },
    milestone: item.milestoneLabel,
    reasons: item.reasons,
  }));
}

export function serialisePath(result: GeneratePathResult, graph: SkillGraph) {
  return {
    pathId: result.path.id,
    learnerId: result.path.learnerId,
    complete: result.path.complete,
    totalHours: result.path.totalHours,
    items: serialisePathItems(result.path),
    gap: serialiseGap(result.gap, graph),
    diff: result.diff,
    supersedes: result.path.supersedes,
  };
}

/** Progress summary for the dashboard. */
export function serialiseProgress(
  learner: StoredLearner,
  path: StoredPath | null,
  graph: SkillGraph,
) {
  const skillIds = new Set<string>([
    ...learner.goalSkills.map((g) => g.skillId),
    ...Object.keys(learner.mastery),
  ]);

  const skills = [...skillIds].map((skillId) => {
    const goal = learner.goalSkills.find((g) => g.skillId === skillId);
    return {
      skillId,
      name: graph.name(skillId),
      level: round(masteryToLevel(learner.mastery[skillId] ?? 0)),
      targetLevel: goal ? goal.level : null,
      isGoal: Boolean(goal),
    };
  });
  skills.sort(
    (a, b) => Number(b.isGoal) - Number(a.isGoal) || b.level - a.level,
  );

  const items = path ? serialisePathItems(path) : [];
  const milestones = items
    .filter((i) => i.milestone)
    .map((i) => ({ position: i.position, label: i.milestone as string }));

  return {
    learnerId: learner.id,
    goalSummary: learner.goalSummary,
    skills,
    totalSteps: items.length,
    totalHours: path?.totalHours ?? 0,
    milestones,
    nextAction: items[0] ?? null,
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
