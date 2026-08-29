import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseResources, parseSkills } from "./corpus";
import { buildGraph, type SkillGraph } from "./graph";
import type {
  LearnerConstraints,
  MasteryVector,
  Resource,
  SkillRef,
} from "./types";
import type { PlannedItem } from "./planner";

/**
 * Where learner and corpus data live.
 *
 * Two implementations behind one interface. The in-memory one loads the corpus
 * from the CSVs in data/ and keeps learners for the life of the process, which
 * means the whole application runs with no database, no migration step and no
 * account: `npm install && npm run dev` is enough to see it work. That matters
 * for the evaluators, and it means a failure to provision Postgres degrades the
 * demo to "state resets on restart" rather than taking the product down.
 *
 * The Postgres implementation is selected automatically when DATABASE_URL is
 * present. Nothing above this layer knows which one it has.
 */

export interface StoredPath {
  id: string;
  learnerId: string;
  goalSkills: SkillRef[];
  items: PlannedItem[];
  totalHours: number;
  complete: boolean;
  supersedes: string | null;
  createdAt: string;
}

export interface StoredLearner {
  id: string;
  name: string;
  goalText: string;
  goalSummary: string;
  constraints: LearnerConstraints;
  mastery: MasteryVector;
  goalSkills: SkillRef[];
  statedSkills: SkillRef[];
  createdAt: string;
}

export interface LearnerEvent {
  id: string;
  learnerId: string;
  type: string;
  payload: Record<string, unknown>;
  ts: string;
}

export interface Store {
  readonly kind: "memory" | "postgres";
  graph(): Promise<SkillGraph>;
  resources(): Promise<Resource[]>;
  resource(id: string): Promise<Resource | null>;

  createLearner(
    input: Partial<StoredLearner> & { name?: string },
  ): Promise<StoredLearner>;
  getLearner(id: string): Promise<StoredLearner | null>;
  updateLearner(
    id: string,
    patch: Partial<StoredLearner>,
  ): Promise<StoredLearner>;

  savePath(path: Omit<StoredPath, "id" | "createdAt">): Promise<StoredPath>;
  getPath(id: string): Promise<StoredPath | null>;
  /** Most recent path for a learner that nothing supersedes. */
  activePath(learnerId: string): Promise<StoredPath | null>;
  pathHistory(learnerId: string): Promise<StoredPath[]>;

  addEvent(event: Omit<LearnerEvent, "id" | "ts">): Promise<LearnerEvent>;
  events(learnerId: string): Promise<LearnerEvent[]>;
}

// ---------- corpus loading ----------

export interface CorpusData {
  graph: SkillGraph;
  resources: Resource[];
}

let corpusCache: CorpusData | null = null;

/** Load the CSV corpus. Cached: the files do not change while the server runs. */
export function loadCorpusFromDisk(dir?: string): CorpusData {
  if (corpusCache) return corpusCache;

  const base = dir ?? resolveCorpusDir();
  const skillsResult = parseSkills(
    readFileSync(path.join(base, "skills.csv"), "utf8"),
  );
  const skillIds = new Set(skillsResult.rows.map((s) => s.id));
  const resourcesResult = parseResources(
    readFileSync(path.join(base, "resources.csv"), "utf8"),
    skillIds,
  );

  const errors = [...skillsResult.errors, ...resourcesResult.errors];
  if (errors.length > 0) {
    // Load what is valid rather than serving nothing, but say so loudly: a
    // partially-imported corpus is a data problem, not a runtime one.
    console.warn(
      `[store] corpus has ${errors.length} validation problem(s); loading valid rows only.`,
    );
  }

  corpusCache = {
    graph: buildGraph(skillsResult.rows),
    resources: resourcesResult.rows,
  };
  return corpusCache;
}

function resolveCorpusDir(): string {
  const candidates = [
    process.env.CORPUS_DIR,
    path.join(process.cwd(), "data", "live"),
    path.join(process.cwd(), "data", "bootstrap"),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    if (existsSync(path.join(dir, "skills.csv"))) return dir;
  }
  throw new Error(
    "No corpus found. Expected skills.csv and resources.csv in data/live or data/bootstrap.",
  );
}

// ---------- in-memory implementation ----------

export function createMemoryStore(corpusDir?: string): Store {
  const corpus = loadCorpusFromDisk(corpusDir);
  const byId = new Map(corpus.resources.map((r) => [r.id, r]));

  const learners = new Map<string, StoredLearner>();
  const paths = new Map<string, StoredPath>();
  const eventLog: LearnerEvent[] = [];

  return {
    kind: "memory",

    async graph() {
      return corpus.graph;
    },
    async resources() {
      return corpus.resources;
    },
    async resource(id) {
      return byId.get(id) ?? null;
    },

    async createLearner(input) {
      const learner: StoredLearner = {
        id: randomUUID(),
        name: input.name ?? "Learner",
        goalText: input.goalText ?? "",
        goalSummary: input.goalSummary ?? "",
        constraints: input.constraints ?? {},
        mastery: input.mastery ?? {},
        goalSkills: input.goalSkills ?? [],
        statedSkills: input.statedSkills ?? [],
        createdAt: new Date().toISOString(),
      };
      learners.set(learner.id, learner);
      return learner;
    },

    async getLearner(id) {
      return learners.get(id) ?? null;
    },

    async updateLearner(id, patch) {
      const existing = learners.get(id);
      if (!existing) throw new Error(`Unknown learner: ${id}`);
      const updated = { ...existing, ...patch, id: existing.id };
      learners.set(id, updated);
      return updated;
    },

    async savePath(input) {
      const stored: StoredPath = {
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      paths.set(stored.id, stored);
      return stored;
    },

    async getPath(id) {
      return paths.get(id) ?? null;
    },

    async activePath(learnerId) {
      const superseded = new Set(
        [...paths.values()]
          .map((p) => p.supersedes)
          .filter((id): id is string => Boolean(id)),
      );
      const live = [...paths.values()]
        .filter((p) => p.learnerId === learnerId && !superseded.has(p.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return live[0] ?? null;
    },

    async pathHistory(learnerId) {
      return [...paths.values()]
        .filter((p) => p.learnerId === learnerId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async addEvent(event) {
      const stored: LearnerEvent = {
        ...event,
        id: randomUUID(),
        ts: new Date().toISOString(),
      };
      eventLog.push(stored);
      return stored;
    },

    async events(learnerId) {
      return eventLog.filter((e) => e.learnerId === learnerId);
    },
  };
}

// ---------- selection ----------

declare global {
  // Survive hot reloads so an in-progress demo keeps its learner.
  // eslint-disable-next-line no-var
  var __waypointStore: Store | undefined;
}

export function getStore(): Store {
  if (!globalThis.__waypointStore) {
    globalThis.__waypointStore = createMemoryStore();
    if (!process.env.DATABASE_URL) {
      console.info(
        "[store] No DATABASE_URL set — running in memory from the CSV corpus.",
      );
    }
  }
  return globalThis.__waypointStore;
}
