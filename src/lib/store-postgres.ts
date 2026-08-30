import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { buildGraph, type SkillGraph } from "./graph";
import type { PlannedItem } from "./planner";
import type {
  LearnerConstraints,
  MasteryVector,
  Resource,
  SkillNode,
  SkillRef,
} from "./types";
import type { LearnerEvent, Store, StoredLearner, StoredPath } from "./store";

/**
 * The durable store.
 *
 * Selected automatically when DATABASE_URL is present. The corpus is read once
 * and cached for the life of the process — it only changes when someone runs an
 * import — while learner state is read and written per request, which is what
 * makes progress survive a restart or a request landing on a different server.
 */

interface CachedCorpus {
  graph: SkillGraph;
  resources: Resource[];
  byId: Map<string, Resource>;
  embeddings: Map<string, number[]>;
}

let corpusPromise: Promise<CachedCorpus> | null = null;

async function loadCorpus(): Promise<CachedCorpus> {
  if (corpusPromise) return corpusPromise;

  corpusPromise = (async () => {
    const [skillRows, prereqRows, resourceRows, linkRows] = await Promise.all([
      db.select().from(schema.skills),
      db.select().from(schema.skillPrereqs),
      db.select().from(schema.resources),
      db.select().from(schema.resourceSkills),
    ]);

    const prereqsBySkill = new Map<string, string[]>();
    for (const row of prereqRows) {
      const list = prereqsBySkill.get(row.skillId) ?? [];
      list.push(row.prereqId);
      prereqsBySkill.set(row.skillId, list);
    }

    const skills: SkillNode[] = skillRows.map((row) => ({
      id: row.id,
      name: row.name,
      domain: row.domain,
      description: row.description,
      prereqs: prereqsBySkill.get(row.id) ?? [],
    }));

    const teaches = new Map<string, SkillRef[]>();
    const requires = new Map<string, SkillRef[]>();
    for (const link of linkRows) {
      const target = link.relation === "teaches" ? teaches : requires;
      const list = target.get(link.resourceId) ?? [];
      list.push({ skillId: link.skillId, level: link.level });
      target.set(link.resourceId, list);
    }

    const resources: Resource[] = resourceRows.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      provider: row.provider,
      type: row.type,
      description: row.description,
      difficulty: row.difficulty,
      estHours: row.estHours,
      quality: row.quality,
      teaches: teaches.get(row.id) ?? [],
      requires: requires.get(row.id) ?? [],
    }));

    const embeddings = new Map<string, number[]>();
    for (const row of resourceRows) {
      if (row.embedding) embeddings.set(row.id, row.embedding);
    }

    return {
      graph: buildGraph(skills),
      resources,
      byId: new Map(resources.map((r) => [r.id, r])),
      embeddings,
    };
  })();

  return corpusPromise;
}

/** Drop the cached corpus. Called after an import writes a new one. */
export function invalidateCorpusCache(): void {
  corpusPromise = null;
}

export function createPostgresStore(): Store {
  return {
    kind: "postgres",

    async graph() {
      return (await loadCorpus()).graph;
    },
    async resources() {
      return (await loadCorpus()).resources;
    },
    async resource(id) {
      return (await loadCorpus()).byId.get(id) ?? null;
    },
    async resourceEmbeddings() {
      const { embeddings } = await loadCorpus();
      return embeddings.size > 0 ? embeddings : null;
    },
    async scenarioCount() {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.evalScenarios);
      return row?.count ?? 0;
    },

    async createLearner(input) {
      const [row] = await db
        .insert(schema.learners)
        .values({
          name: input.name ?? "Learner",
          goalText: input.goalText ?? "",
          goalSummary: input.goalSummary ?? "",
          goalSkills: input.goalSkills ?? [],
          statedSkills: input.statedSkills ?? [],
          constraints: input.constraints ?? {},
        })
        .returning();

      await writeMastery(row.id, input.mastery ?? {});
      return toLearner(row, input.mastery ?? {});
    },

    async getLearner(id) {
      const [row] = await db
        .select()
        .from(schema.learners)
        .where(eq(schema.learners.id, id))
        .limit(1);
      if (!row) return null;

      const skills = await db
        .select()
        .from(schema.learnerSkills)
        .where(eq(schema.learnerSkills.learnerId, id));

      const mastery: MasteryVector = {};
      for (const s of skills) mastery[s.skillId] = s.mastery;
      return toLearner(row, mastery);
    },

    async updateLearner(id, patch) {
      const fields: Record<string, unknown> = {};
      if (patch.name !== undefined) fields.name = patch.name;
      if (patch.goalText !== undefined) fields.goalText = patch.goalText;
      if (patch.goalSummary !== undefined)
        fields.goalSummary = patch.goalSummary;
      if (patch.goalSkills !== undefined) fields.goalSkills = patch.goalSkills;
      if (patch.statedSkills !== undefined)
        fields.statedSkills = patch.statedSkills;
      if (patch.constraints !== undefined)
        fields.constraints = patch.constraints;

      if (Object.keys(fields).length > 0) {
        await db
          .update(schema.learners)
          .set(fields)
          .where(eq(schema.learners.id, id));
      }
      if (patch.mastery !== undefined) {
        await writeMastery(id, patch.mastery);
      }

      const updated = await createPostgresStore().getLearner(id);
      if (!updated) throw new Error(`Unknown learner: ${id}`);
      return updated;
    },

    async savePath(input) {
      const [row] = await db
        .insert(schema.paths)
        .values({
          learnerId: input.learnerId,
          goalSkills: input.goalSkills,
          totalHours: input.totalHours,
          complete: input.complete,
          supersedes: input.supersedes,
        })
        .returning();

      if (input.items.length > 0) {
        await db.insert(schema.pathItems).values(
          input.items.map((item, index) => ({
            pathId: row.id,
            position: index,
            resourceId: item.resource.id,
            reasons: item.reasons,
            milestoneLabel: item.milestoneLabel,
          })),
        );
      }

      return {
        ...input,
        id: row.id,
        createdAt: row.createdAt.toISOString(),
      };
    },

    async getPath(id) {
      const [row] = await db
        .select()
        .from(schema.paths)
        .where(eq(schema.paths.id, id))
        .limit(1);
      return row ? hydratePath(row) : null;
    },

    async activePath(learnerId) {
      /**
       * The live path is the newest one that nothing supersedes. Asked as a
       * subquery so the database answers it, rather than loading every path the
       * learner has ever had in order to work it out here.
       */
      const [row] = await db
        .select()
        .from(schema.paths)
        .where(
          and(
            eq(schema.paths.learnerId, learnerId),
            sql`NOT EXISTS (
              SELECT 1 FROM ${schema.paths} AS newer
              WHERE newer.supersedes = ${schema.paths.id}
            )`,
          ),
        )
        .orderBy(desc(schema.paths.createdAt))
        .limit(1);

      return row ? hydratePath(row) : null;
    },

    async pathHistory(learnerId) {
      const rows = await db
        .select()
        .from(schema.paths)
        .where(eq(schema.paths.learnerId, learnerId))
        .orderBy(asc(schema.paths.createdAt));
      return Promise.all(rows.map(hydratePath));
    },

    async addEvent(event) {
      const [row] = await db
        .insert(schema.events)
        .values({
          learnerId: event.learnerId,
          type: event.type,
          payload: event.payload,
        })
        .returning();

      return {
        id: row.id,
        learnerId: row.learnerId,
        type: row.type,
        payload: row.payload as Record<string, unknown>,
        ts: row.ts.toISOString(),
      };
    },

    async events(learnerId) {
      const rows = await db
        .select()
        .from(schema.events)
        .where(eq(schema.events.learnerId, learnerId))
        .orderBy(asc(schema.events.ts));

      return rows.map((row): LearnerEvent => ({
        id: row.id,
        learnerId: row.learnerId,
        type: row.type,
        payload: row.payload as Record<string, unknown>,
        ts: row.ts.toISOString(),
      }));
    },
  };
}

/**
 * Replace the learner's mastery vector. Rewritten wholesale rather than diffed:
 * a vector is a few dozen rows, and a full rewrite cannot leave a stale skill
 * behind after a struggle event knocks one down.
 */
async function writeMastery(
  learnerId: string,
  mastery: MasteryVector,
): Promise<void> {
  await db
    .delete(schema.learnerSkills)
    .where(eq(schema.learnerSkills.learnerId, learnerId));

  const rows = Object.entries(mastery)
    .filter(([, value]) => value > 0)
    .map(([skillId, value]) => ({
      learnerId,
      skillId,
      mastery: value,
      source: "inferred" as const,
    }));

  if (rows.length > 0) await db.insert(schema.learnerSkills).values(rows);
}

async function hydratePath(
  row: typeof schema.paths.$inferSelect,
): Promise<StoredPath> {
  const itemRows = await db
    .select()
    .from(schema.pathItems)
    .where(eq(schema.pathItems.pathId, row.id))
    .orderBy(asc(schema.pathItems.position));

  const { byId } = await loadCorpus();

  const items: PlannedItem[] = itemRows
    .map((item) => {
      const resource = byId.get(item.resourceId);
      if (!resource) return null; // corpus re-imported without this resource
      return {
        resource,
        reasons: item.reasons as PlannedItem["reasons"],
        milestoneLabel: item.milestoneLabel,
      };
    })
    .filter((item): item is PlannedItem => item !== null);

  return {
    id: row.id,
    learnerId: row.learnerId,
    goalSkills: row.goalSkills as SkillRef[],
    items,
    totalHours: row.totalHours,
    complete: row.complete,
    supersedes: row.supersedes,
    createdAt: row.createdAt.toISOString(),
  };
}

function toLearner(
  row: typeof schema.learners.$inferSelect,
  mastery: MasteryVector,
): StoredLearner {
  return {
    id: row.id,
    name: row.name,
    goalText: row.goalText,
    goalSummary: row.goalSummary,
    constraints: row.constraints as LearnerConstraints,
    mastery,
    goalSkills: row.goalSkills as SkillRef[],
    statedSkills: row.statedSkills as SkillRef[],
    createdAt: row.createdAt.toISOString(),
  };
}
