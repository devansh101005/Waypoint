/**
 * Domain types shared by the planner, retriever, API routes and eval harness.
 * The `Reasons` object is the contract that makes explanations hallucination-proof:
 * the LLM phrases it, and may not add anything that is not in it.
 */

export type SkillId = string;
export type ResourceId = string;

export interface SkillRef {
  skillId: SkillId;
  level: number; // 1..5
}

/** Mastery vector: skillId -> 0..1. Absent key means 0. */
export type MasteryVector = Record<SkillId, number>;

export interface LearnerConstraints {
  hoursPerWeek?: number;
  deadlineWeeks?: number;
  formats?: string[];
}

export interface LearnerProfile {
  id: string;
  name: string;
  goalText: string;
  constraints: LearnerConstraints;
  mastery: MasteryVector;
  goalSkills: SkillRef[];
}

export interface SkillNode {
  id: SkillId;
  name: string;
  domain: string;
  description: string;
  prereqs: SkillId[];
}

export interface Resource {
  id: ResourceId;
  title: string;
  url: string;
  provider: string;
  type: "course" | "video" | "article" | "project" | "assessment";
  description: string;
  difficulty: number; // 1..5
  estHours: number;
  quality: number; // 1..5
  teaches: SkillRef[];
  requires: SkillRef[];
}

/** A single unmet skill need: how far the learner is from the target level. */
export interface GapEntry {
  skillId: SkillId;
  current: number; // 0..1 mastery
  target: number; // 0..1 mastery implied by target level
  weight: number; // importance for ranking (goal skills > ancestors)
  isGoal: boolean; // directly requested vs. pulled in as a prerequisite
}

export type Gap = GapEntry[];

/** Retrieval scoring breakdown — kept for the /eval page and debugging. */
export interface ScoreBreakdown {
  tag: number;
  dense: number;
  lexical: number;
  qualityPrior: number;
  total: number;
  reranked?: number;
}

export interface ScoredResource {
  resource: Resource;
  score: ScoreBreakdown;
}

/** Why a resource is at this position. The LLM may only rephrase these facts. */
export interface Reasons {
  coversGapSkills: Array<{
    skillId: SkillId;
    name: string;
    fromLevel: number;
    toLevel: number;
  }>;
  unlockedBy: Array<{
    resourceId: ResourceId;
    title: string;
    skillId: SkillId;
  }>;
  unlocks: Array<{ skillId: SkillId; name: string }>;
  difficultyFit: {
    resourceDifficulty: number;
    learnerLevel: number;
    verdict: "easy" | "aligned" | "stretch";
  };
  estHours: number;
  milestoneContribution: string | null;
  scoreBreakdown: ScoreBreakdown;
}

export interface PathItem {
  position: number;
  resource: Resource;
  reasons: Reasons;
  milestoneLabel: string | null;
  status: "pending" | "in_progress" | "done" | "struggled" | "skipped";
}

export interface LearningPath {
  id: string;
  learnerId: string;
  goalSkills: SkillRef[];
  items: PathItem[];
  totalHours: number;
  supersedes: string | null;
}

/** Diff between a superseded path and its replacement, for the adaptation view. */
export interface PathDiff {
  added: Array<{
    resourceId: ResourceId;
    title: string;
    position: number;
    why: string;
  }>;
  removed: Array<{ resourceId: ResourceId; title: string }>;
  moved: Array<{
    resourceId: ResourceId;
    title: string;
    from: number;
    to: number;
  }>;
  summary: string;
}

export interface EvalScenario {
  id: string;
  persona: {
    personaName: string;
    background: string;
    statedSkills: SkillRef[];
    hoursPerWeek: number;
  };
  goal: string;
  expertPath: ResourceId[];
  rationale: string;
}

export interface EvalMetrics {
  system: string;
  prereqViolationRate: number;
  gapCoverage: number;
  redundancy: number;
  ndcg: number;
  kendallTau: number;
  totalHours: number;
}
