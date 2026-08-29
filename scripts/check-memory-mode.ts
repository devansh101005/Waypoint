/** Prove the application still runs with no database configured. */
delete process.env.DATABASE_URL;

async function main() {
  const { getStore } = await import("../src/lib/store");
  const store = getStore();
  const graph = await store.graph();
  const resources = await store.resources();
  const learner = await store.createLearner({
    goalSkills: [{ skillId: "dashboarding", level: 4 }],
  });

  if (store.kind !== "memory") throw new Error(`expected memory store, got ${store.kind}`);
  console.log(`store kind: ${store.kind}`);
  console.log(`corpus: ${graph.all().length} skills, ${resources.length} resources`);
  console.log(`learner created: ${learner.id.slice(0, 8)}…`);
  console.log("no-database mode: OK");
  process.exit(0);
}

main().catch((e) => {
  console.error("no-database mode BROKEN:", e instanceof Error ? e.message : e);
  process.exit(1);
});
