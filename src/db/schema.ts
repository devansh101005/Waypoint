import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// ---------- enums ----------

export const resourceType = pgEnum("resource_type", [
  "course",
  "video",
  "article",
  "project",
  "assessment",
]);

export const skillRelation = pgEnum("skill_relation", ["teaches", "requires"]);

export const masterySource = pgEnum("mastery_source", [
  "stated",
  "completed_course",
  "quiz",
  "feedback",
  "inferred",
]);

export const pathItemStatus = pgEnum("path_item_status", [
  "pending",
  "in_progress",
  "done",
  "struggled",
  "skipped",
]);

// ---------- skill graph ----------

export const skills = pgTable("skills", {
  id: text("id").primaryKey(), // kebab-case slug
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  description: text("description").notNull().default(""),
});

export const skillPrereqs = pgTable(
  "skill_prereqs",
  {
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    prereqId: text("prereq_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.skillId, t.prereqId] })],
);

// ---------- corpus ----------

export const resources = pgTable("resources", {
  id: text("id").primaryKey(), // RES-###
  title: text("title").notNull(),
  url: text("url").notNull(),
  provider: text("provider").notNull().default(""),
  type: resourceType("type").notNull(),
  description: text("description").notNull().default(""),
  difficulty: integer("difficulty").notNull(), // 1..5
  estHours: real("est_hours").notNull(),
  quality: integer("quality").notNull().default(3), // 1..5
  embedding: vector("embedding", { dimensions: 1536 }),
});

export const resourceSkills = pgTable(
  "resource_skills",
  {
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    relation: skillRelation("relation").notNull(),
    level: integer("level").notNull(), // 1..5
  },
  (t) => [primaryKey({ columns: [t.resourceId, t.skillId, t.relation] })],
);

// ---------- learners ----------

export const learners = pgTable("learners", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  goalText: text("goal_text").notNull().default(""),
  // { hoursPerWeek?: number; deadlineWeeks?: number; formats?: string[] }
  constraints: jsonb("constraints").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const learnerSkills = pgTable(
  "learner_skills",
  {
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    mastery: real("mastery").notNull(), // 0..1
    source: masterySource("source").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.learnerId, t.skillId] })],
);

// ---------- paths (immutable; replans create new rows) ----------

export const paths = pgTable("paths", {
  id: uuid("id").primaryKey().defaultRandom(),
  learnerId: uuid("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  // [{ skillId, targetLevel }]
  goalSkills: jsonb("goal_skills").notNull().default([]),
  supersedes: uuid("supersedes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pathItems = pgTable(
  "path_items",
  {
    pathId: uuid("path_id")
      .notNull()
      .references(() => paths.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id),
    status: pathItemStatus("status").notNull().default("pending"),
    // ReasonsObject — see src/lib/types.ts
    reasons: jsonb("reasons").notNull().default({}),
    milestoneLabel: text("milestone_label"),
  },
  (t) => [primaryKey({ columns: [t.pathId, t.position] })],
);

// ---------- feedback log (append-only) ----------

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  learnerId: uuid("learner_id")
    .notNull()
    .references(() => learners.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // done | struggled | skipped | quiz | ...
  payload: jsonb("payload").notNull().default({}),
  ts: timestamp("ts").notNull().defaultNow(),
});

// ---------- eval ground truth ----------

export const evalScenarios = pgTable("eval_scenarios", {
  id: text("id").primaryKey(), // SCN-##
  // { personaName, background, statedSkills: [{skillId, level}], hoursPerWeek }
  persona: jsonb("persona").notNull(),
  goal: text("goal").notNull(),
  // ordered resource ids
  expertPath: jsonb("expert_path").notNull(),
  rationale: text("rationale").notNull().default(""),
});
