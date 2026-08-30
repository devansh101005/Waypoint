/**
 * Corpus import: spreadsheet CSVs → Postgres.
 *
 *   npm run import                          # bootstrap corpus (data/bootstrap/*)
 *   npm run import -- skills.csv resources.csv [scenarios.csv]
 *
 * Validates everything first and refuses to write a partial corpus: either the
 * whole drop is clean, or you get a row-numbered report to send back to the
 * person who owns the sheet. Idempotent — re-running replaces the corpus.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { sql } from "drizzle-orm";

config({ path: ".env.local" });

async function main() {
  const args = process.argv.slice(2);
  const [skillsPath, resourcesPath, scenariosPath] =
    args.length >= 2
      ? args
      : [
          path.join("data", "bootstrap", "skills.csv"),
          path.join("data", "bootstrap", "resources.csv"),
          path.join("data", "bootstrap", "scenarios.csv"),
        ];

  // Imported lazily so a validation-only run does not require DATABASE_URL.
  const { parseResources, parseScenarios, parseSkills, formatErrors } =
    await import("../src/lib/corpus");

  for (const p of [skillsPath, resourcesPath]) {
    if (!existsSync(p)) {
      console.error(`✖ File not found: ${p}`);
      process.exit(1);
    }
  }

  console.log(
    `Reading:\n  skills    ${skillsPath}\n  resources ${resourcesPath}`,
  );

  const skillsResult = parseSkills(
    readFileSync(skillsPath, "utf8"),
    path.basename(skillsPath),
  );
  const skillIds = new Set(skillsResult.rows.map((s) => s.id));
  const resourcesResult = parseResources(
    readFileSync(resourcesPath, "utf8"),
    skillIds,
    path.basename(resourcesPath),
  );
  const resourceIds = new Set(resourcesResult.rows.map((r) => r.id));

  let scenariosResult: ReturnType<typeof parseScenarios> = { rows: [], errors: [] };
  if (scenariosPath && existsSync(scenariosPath)) {
    console.log(`  scenarios ${scenariosPath}`);
    scenariosResult = parseScenarios(
      readFileSync(scenariosPath, "utf8"),
      skillIds,
      resourceIds,
      path.basename(scenariosPath),
    );
  }

  const errors = [
    ...skillsResult.errors,
    ...resourcesResult.errors,
    ...scenariosResult.errors,
  ];
  if (errors.length > 0) {
    console.error("\n✖ The sheet has problems. Nothing was imported.");
    console.error(formatErrors(errors));
    console.error(
      `\nFix these rows in the Google Sheet, re-export the CSVs, and run the import again.\n` +
        `Row numbers match the sheet (row 1 is the header).`,
    );
    process.exit(1);
  }

  console.log(
    `\n✔ Validation passed: ${skillsResult.rows.length} skills, ` +
      `${resourcesResult.rows.length} resources, ${scenariosResult.rows.length} scenarios.`,
  );

  if (process.argv.includes("--validate-only")) {
    console.log("--validate-only: stopping before database write.");
    return;
  }

  const { db, schema } = await import("../src/db");
  const { embedDocuments, resourceCard } =
    await import("../src/lib/embeddings");

  // Embed in batches; a null result means no Cohere key — the scorer copes.
  const cards = resourcesResult.rows.map(resourceCard);
  const vectors: (number[] | null)[] = new Array(cards.length).fill(null);
  const BATCH = 90; // Cohere caps at 96 texts per call
  let embedded = 0;
  for (let i = 0; i < cards.length; i += BATCH) {
    const slice = cards.slice(i, i + BATCH);
    const out = await embedDocuments(slice);
    if (!out) break;
    out.forEach((v, j) => {
      vectors[i + j] = v;
      embedded++;
    });
    console.log(
      `  embedded ${Math.min(i + BATCH, cards.length)}/${cards.length}`,
    );
  }
  if (embedded === 0) {
    console.warn(
      "⚠ No embeddings generated (COHERE_API_KEY unset or call failed).",
    );
    console.warn(
      "  Import continues; retrieval will use tag + lexical signals only.",
    );
  }

  console.log("\nWriting to database…");
  await db.transaction(async (tx) => {
    /**
     * Replacing the corpus invalidates anything that points into it.
     *
     * Saved paths reference resource ids by foreign key, so they physically
     * cannot survive a swap — and a path built from resources that no longer
     * exist is not worth keeping. Mastery is different: a skill slug present in
     * both corpora describes the same thing, so it is carried across rather
     * than lost to the cascade. Learners and their event history are untouched.
     */
    const keptMastery = await tx.select().from(schema.learnerSkills);
    const pathRows = await tx.select({ id: schema.paths.id }).from(schema.paths);
    const pathCount = pathRows.length;

    await tx.delete(schema.pathItems);
    await tx.delete(schema.paths);
    await tx.delete(schema.resourceSkills);
    await tx.delete(schema.evalScenarios);
    await tx.delete(schema.resources);
    await tx.delete(schema.skillPrereqs);
    await tx.delete(schema.skills);

    await tx.insert(schema.skills).values(
      skillsResult.rows.map((s) => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        description: s.description,
      })),
    );

    const edges = skillsResult.rows.flatMap((s) =>
      s.prereqs.map((p) => ({ skillId: s.id, prereqId: p })),
    );
    if (edges.length) await tx.insert(schema.skillPrereqs).values(edges);

    await tx.insert(schema.resources).values(
      resourcesResult.rows.map((r, i) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        provider: r.provider,
        type: r.type,
        description: r.description,
        difficulty: r.difficulty,
        estHours: r.estHours,
        quality: r.quality,
        embedding: vectors[i],
      })),
    );

    const links = resourcesResult.rows.flatMap((r) => [
      ...r.teaches.map((t) => ({
        resourceId: r.id,
        skillId: t.skillId,
        relation: "teaches" as const,
        level: t.level,
      })),
      ...r.requires.map((t) => ({
        resourceId: r.id,
        skillId: t.skillId,
        relation: "requires" as const,
        level: t.level,
      })),
    ]);
    if (links.length) await tx.insert(schema.resourceSkills).values(links);

    // Carry mastery across for every skill that still exists.
    const survivingSkills = new Set(skillsResult.rows.map((s) => s.id));
    const carried = keptMastery.filter((row) =>
      survivingSkills.has(row.skillId),
    );
    if (carried.length > 0) {
      await tx.insert(schema.learnerSkills).values(
        carried.map((row) => ({
          learnerId: row.learnerId,
          skillId: row.skillId,
          mastery: row.mastery,
          source: row.source,
        })),
      );
    }
    if (keptMastery.length > 0 || pathCount > 0) {
      console.log(
        `  carried ${carried.length}/${keptMastery.length} mastery entries across; ` +
          `discarded ${pathCount} saved path(s) built on the old corpus`,
      );
    }


    if (scenariosResult.rows.length) {
      await tx.insert(schema.evalScenarios).values(
        scenariosResult.rows.map((s) => ({
          id: s.id,
          persona: s.persona,
          goal: s.goal,
          expertPath: s.expertPath,
          rationale: s.rationale,
        })),
      );
    }
  });

  const [{ count }] = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from resources`,
  );
  console.log(
    `\n✔ Import complete: ${skillsResult.rows.length} skills, ${count} resources ` +
      `(${embedded} embedded), ${scenariosResult.rows.length} scenarios.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✖ Import failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
