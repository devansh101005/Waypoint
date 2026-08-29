import Link from "next/link";

const CAPABILITIES = [
  {
    title: "Say it in your own words",
    body: "Describe the goal however you think about it. It compiles into concrete skills and levels while you type.",
  },
  {
    title: "The gap, not the query",
    body: "Retrieval matches what you still need against what each resource teaches — not your sentence against course marketing copy.",
  },
  {
    title: "An order you can actually follow",
    body: "The prerequisite graph decides what is eligible at each step, so nothing arrives before you are ready for it.",
  },
  {
    title: "Reasons you can check",
    body: "Every step carries the skills it closes, what unlocked it, and what it opens up. The assistant phrases that; it never invents it.",
  },
  {
    title: "It changes when you do",
    body: "Say a course did not work and the route re-plans around it, showing you exactly what moved and why.",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen">
      <div
        aria-hidden="true"
        className="survey-ground pointer-events-none absolute inset-0 opacity-[0.18]"
      />

      <div className="relative mx-auto max-w-3xl px-6 py-20">
        <p className="text-route-ink text-xs font-semibold tracking-[0.28em] uppercase">
          Waypoint
        </p>

        <h1 className="mt-5 font-[family-name:var(--font-display)] text-4xl leading-[1.08] font-semibold text-balance sm:text-5xl">
          A learning path is a route, not a search result.
        </h1>

        <p className="text-ink-muted mt-5 max-w-2xl text-lg text-pretty">
          Waypoint models you as a mastery vector over a skill graph, compiles
          your goal into a target state, and plans a prerequisite-feasible route
          that closes the difference in the fewest hours — then explains every
          step from the plan that produced it.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/start"
            className="bg-primary text-primary-foreground focus-visible:ring-ring rounded-md px-5 py-2.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Plan my route
          </Link>
          <Link
            href="/eval"
            className="border-hairline hover:border-route focus-visible:ring-ring rounded-md border px-5 py-2.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            See the evaluation
          </Link>
        </div>

        <p className="text-ink-muted mt-3 text-sm">
          No account needed. Prefer to skip the conversation?{" "}
          <Link
            href="/plan"
            className="text-foreground underline underline-offset-4"
          >
            Pick a destination directly
          </Link>
          .
        </p>

        <section aria-labelledby="how" className="mt-16">
          <h2 id="how" className="sr-only">
            How it works
          </h2>
          <ol className="border-hairline divide-hairline divide-y border-t border-b">
            {CAPABILITIES.map((item, index) => (
              <li
                key={item.title}
                className="grid grid-cols-[2.5rem_1fr] gap-4 py-5"
              >
                <span
                  aria-hidden="true"
                  className="text-route-ink font-[family-name:var(--font-display)] text-sm font-semibold"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">
                    {item.title}
                  </h3>
                  <p className="text-ink-muted mt-1 text-pretty">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer className="text-ink-muted mt-12 text-sm">
          Built for the HCL prototype round. The{" "}
          <Link
            href="/eval"
            className="text-foreground underline underline-offset-4"
          >
            evaluation page
          </Link>{" "}
          scores this planner against expert-written learning paths, alongside
          the similarity search it is meant to beat.
        </footer>
      </div>
    </main>
  );
}
