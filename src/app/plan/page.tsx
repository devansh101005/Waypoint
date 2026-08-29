"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PathRoute, type RouteItem } from "@/components/path-route";
import type { PathDiff } from "@/lib/types";

interface CatalogueSkill {
  id: string;
  name: string;
  domain: string;
  teachable: boolean;
}

interface GapEntry {
  skillId: string;
  name: string;
  currentLevel: number;
  targetLevel: number;
  isGoal: boolean;
}

interface PathResponse {
  pathId: string;
  learnerId: string;
  complete: boolean;
  totalHours: number;
  items: RouteItem[];
  gap: GapEntry[];
  diff: PathDiff | null;
  error?: string;
  detail?: string;
}

export default function PlanPage() {
  const [catalogue, setCatalogue] = useState<CatalogueSkill[]>([]);
  const [goal, setGoal] = useState("");
  const [known, setKnown] = useState<string[]>([]);
  const [result, setResult] = useState<PathResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "planning" | "error">("idle");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/demo")
      .then((r) => r.json())
      .then((data) => {
        const skills: CatalogueSkill[] = data.skills ?? [];
        setCatalogue(skills);
        const first = skills.find((s) => s.teachable);
        if (first) setGoal(first.id);
      })
      .catch(() => setMessage("Could not load the skill catalogue."));
  }, []);

  async function plan() {
    if (!goal) return;
    setStatus("planning");
    setMessage("");
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalSkills: [{ skillId: goal, level: 4 }],
          statedSkills: known.map((skillId) => ({ skillId, level: 3 })),
          goalText: `I want to learn ${catalogue.find((s) => s.id === goal)?.name ?? goal}`,
        }),
      });
      const data: PathResponse = await response.json();
      if (!response.ok) {
        setStatus("error");
        setMessage(data.detail ?? "Planning failed.");
        return;
      }
      setResult(data);
      setStatus("idle");
    } catch {
      setStatus("error");
      setMessage("Could not reach the planner.");
    }
  }

  async function sendFeedback(resourceId: string, event: "done" | "struggled") {
    if (!result) return;
    setBusy(resourceId);
    try {
      const response = await fetch("/api/paths/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerId: result.learnerId,
          pathId: result.pathId,
          resourceId,
          event,
        }),
      });
      const data: PathResponse = await response.json();
      if (!response.ok) {
        setMessage(data.detail ?? "Could not update your route.");
        return;
      }
      setResult(data);
    } catch {
      setMessage("Could not reach the planner.");
    } finally {
      setBusy(null);
    }
  }

  const changed = new Set(result?.diff?.added.map((a) => a.resourceId) ?? []);
  const goalSkills = catalogue.filter((s) => s.teachable);

  return (
    <main className="relative min-h-screen">
      <div
        aria-hidden="true"
        className="survey-ground pointer-events-none absolute inset-0 opacity-[0.18]"
      />

      <div className="relative mx-auto max-w-3xl px-6 py-14">
        <header className="mb-10">
          <Link
            href="/"
            className="text-ink-muted hover:text-ink text-xs tracking-[0.2em] uppercase"
          >
            Waypoint
          </Link>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-tight font-semibold text-balance sm:text-4xl">
            Plot a route to what you want to learn
          </h1>
          <p className="text-ink-muted mt-2 text-pretty">
            Pick a destination and tell us what you already know. The planner
            works out what stands between the two and orders it so nothing
            arrives before you are ready for it.
          </p>
        </header>

        <section
          aria-labelledby="setup"
          className="border-hairline bg-paper-raised mb-10 rounded-lg border p-5"
        >
          <h2 id="setup" className="sr-only">
            Choose your destination
          </h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="goal"
                className="text-ink-muted mb-1.5 block text-xs tracking-wide uppercase"
              >
                Destination
              </label>
              <select
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="border-hairline bg-paper focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                {goalSkills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.domain})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="known"
                className="text-ink-muted mb-1.5 block text-xs tracking-wide uppercase"
              >
                Already comfortable with
              </label>
              <select
                id="known"
                multiple
                value={known}
                onChange={(e) =>
                  setKnown([...e.target.selectedOptions].map((o) => o.value))
                }
                className="border-hairline bg-paper focus-visible:ring-ring h-24 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                {catalogue.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="text-ink-muted mt-1 text-xs">
                Hold ctrl or cmd to choose several. Leave empty if you are
                starting fresh.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={plan}
            disabled={status === "planning" || !goal}
            className="bg-primary text-primary-foreground focus-visible:ring-ring mt-5 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {status === "planning" ? "Plotting…" : "Plot my route"}
          </button>

          {message && (
            <p role="alert" className="text-destructive mt-3 text-sm">
              {message}
            </p>
          )}
        </section>

        {result && (
          <>
            <section aria-labelledby="summary" className="mb-8">
              <h2 id="summary" className="sr-only">
                Route summary
              </h2>
              <dl className="border-hairline flex flex-wrap gap-x-8 gap-y-3 border-y py-4 font-mono text-sm">
                <Stat label="Steps" value={String(result.items.length)} />
                <Stat label="Hours" value={`${result.totalHours}`} />
                <Stat
                  label="Skills to close"
                  value={String(result.gap.length)}
                />
                <Stat
                  label="Reaches goal"
                  value={result.complete ? "yes" : "partly"}
                />
              </dl>
            </section>

            {result.diff &&
              result.diff.summary !== "Your path is unchanged." && (
                <section
                  aria-live="polite"
                  className="border-route bg-accent/40 mb-8 rounded-r-md border-l-2 py-3 pr-4 pl-4"
                >
                  <p className="text-route-ink text-xs font-semibold tracking-[0.18em] uppercase">
                    Route updated
                  </p>
                  <p className="mt-1 text-sm">{result.diff.summary}</p>
                  <ul className="text-ink-muted mt-2 space-y-1 text-sm">
                    {result.diff.completed.map((c) => (
                      <li key={c.resourceId}>
                        Marked{" "}
                        <span className="text-ink font-medium">{c.title}</span>{" "}
                        complete.
                      </li>
                    ))}
                    {result.diff.replaced.map((r) => (
                      <li key={r.resourceId}>
                        Swapped out{" "}
                        <span className="text-ink font-medium">{r.title}</span>{" "}
                        — it was not working for you.
                      </li>
                    ))}
                    {result.diff.added.map((a) => (
                      <li key={a.resourceId}>
                        Added{" "}
                        <span className="text-ink font-medium">{a.title}</span>{" "}
                        at step {a.position} — {a.why}.
                      </li>
                    ))}
                    {result.diff.removed.map((r) => (
                      <li key={r.resourceId}>
                        Dropped{" "}
                        <span className="text-ink font-medium">{r.title}</span>{" "}
                        — another step now covers it.
                      </li>
                    ))}
                  </ul>
                </section>
              )}

            <section aria-labelledby="route">
              <h2
                id="route"
                className="mb-5 font-[family-name:var(--font-display)] text-xl font-semibold"
              >
                Your route
              </h2>
              <PathRoute
                items={result.items}
                onFeedback={sendFeedback}
                busyResourceId={busy}
                changedResourceIds={changed}
              />
            </section>

            {result.gap.length > 0 && (
              <section aria-labelledby="gap" className="mt-10">
                <h2
                  id="gap"
                  className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold"
                >
                  What stands between you and the destination
                </h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {result.gap.map((g) => (
                    <li
                      key={g.skillId}
                      className="border-hairline flex items-baseline justify-between gap-3 border-b pb-2 text-sm"
                    >
                      <span className={g.isGoal ? "font-medium" : undefined}>
                        {g.name}
                        {g.isGoal && (
                          <span className="text-route-ink ml-2 text-xs uppercase">
                            goal
                          </span>
                        )}
                      </span>
                      <span className="text-ink-muted font-mono text-xs whitespace-nowrap">
                        {g.currentLevel} → {g.targetLevel}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-muted text-xs tracking-wide uppercase">
        {label}
      </dt>
      <dd className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        {value}
      </dd>
    </div>
  );
}
