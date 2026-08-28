import Link from "next/link";

const STATUS = [
  { label: "Skill graph + corpus import", state: "ready" },
  { label: "Gap model + path planner", state: "building" },
  { label: "Conversational intake", state: "building" },
  { label: "Adaptation loop", state: "planned" },
  { label: "Evaluation harness", state: "planned" },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-6 py-16">
      <header className="space-y-4">
        <p className="text-sm font-medium tracking-[0.2em] text-amber-700 uppercase dark:text-amber-400">
          Waypoint
        </p>
        <h1 className="text-4xl leading-tight font-semibold text-balance sm:text-5xl">
          A learning path is a route, not a search result.
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg text-pretty">
          Waypoint models a learner as a mastery vector over a skill graph,
          compiles their goal into a target state, and plans a
          prerequisite-feasible route that closes the gap in the fewest hours —
          then explains every step from the plan itself.
        </p>
      </header>

      <section aria-labelledby="status-heading" className="space-y-3">
        <h2 id="status-heading" className="text-sm font-medium">
          Build status
        </h2>
        <ul className="space-y-2">
          {STATUS.map((item) => (
            <li key={item.label} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden="true"
                className={
                  item.state === "ready"
                    ? "size-2 rounded-full bg-amber-500"
                    : item.state === "building"
                      ? "size-2 rounded-full bg-amber-500/40"
                      : "border-muted-foreground/40 size-2 rounded-full border"
                }
              />
              <span className="text-foreground">{item.label}</span>
              <span className="text-muted-foreground ml-auto text-xs tracking-wide uppercase">
                {item.state}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="text-muted-foreground text-sm">
        HCL Round 2 prototype ·{" "}
        <Link
          className="text-foreground underline underline-offset-4"
          href="/eval"
        >
          evaluation results
        </Link>{" "}
        (coming in phase 5)
      </footer>
    </main>
  );
}
