"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SkillMeter } from "@/components/skill-meter";
import type { Reasons } from "@/lib/types";

/**
 * The learner's standing at a glance: how far along the route they are, what
 * their skills look like now, which milestones are ahead, and the single next
 * thing to do. Everything here is derived from the same plan the route view
 * shows, so the two can never disagree.
 */

interface Progress {
  learnerId: string;
  goalSummary: string;
  skills: Array<{
    skillId: string;
    name: string;
    level: number;
    targetLevel: number | null;
    isGoal: boolean;
  }>;
  totalSteps: number;
  totalHours: number;
  complete: boolean;
  milestones: Array<{ position: number; label: string }>;
  nextAction: {
    position: number;
    resource: {
      id: string;
      title: string;
      url: string;
      provider: string;
      estHours: number;
    };
    reasons: Reasons;
  } | null;
  activity: Array<{ type: string; resourceId: string | null; at: string }>;
  error?: string;
}

export default function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<Progress | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/learners/${id}`);
      if (response.status === 404) {
        setStatus("missing");
        return;
      }
      if (!response.ok) {
        setStatus("error");
        return;
      }
      setData(await response.json());
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const goalSkills = data?.skills.filter((s) => s.isGoal) ?? [];
  const supporting = data?.skills.filter((s) => !s.isGoal && s.level > 0) ?? [];
  const goalsReached = goalSkills.filter(
    (s) => s.targetLevel !== null && s.level >= s.targetLevel,
  ).length;

  return (
    <main className="relative min-h-screen">
      <div
        aria-hidden="true"
        className="survey-ground pointer-events-none absolute inset-0 opacity-[0.18]"
      />

      <div className="relative mx-auto max-w-3xl px-6 py-12">
        <header className="mb-8">
          <Link
            href="/"
            className="text-ink-muted hover:text-ink text-xs tracking-[0.2em] uppercase"
          >
            Waypoint
          </Link>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-tight font-semibold text-balance">
            Where you stand
          </h1>
          {data?.goalSummary && (
            <p className="text-ink-muted mt-2 text-pretty">
              {data.goalSummary}
            </p>
          )}
        </header>

        {status === "loading" && (
          <p className="text-ink-muted text-sm">Loading your progress…</p>
        )}

        {status === "missing" && (
          <p className="border-hairline rounded-md border border-dashed p-6 text-sm">
            No learner with that id. This happens if the server restarted —
            learner state is held in memory unless a database is configured.{" "}
            <Link href="/start" className="underline underline-offset-4">
              Start a new plan
            </Link>
            .
          </p>
        )}

        {status === "error" && (
          <p role="alert" className="text-destructive text-sm">
            Could not load your progress.{" "}
            <button
              type="button"
              onClick={() => void load()}
              className="underline underline-offset-4"
            >
              Try again
            </button>
          </p>
        )}

        {status === "ready" && data && (
          <div className="space-y-10">
            <section aria-labelledby="summary">
              <h2 id="summary" className="sr-only">
                Summary
              </h2>
              <dl className="border-hairline flex flex-wrap gap-x-10 gap-y-4 border-y py-4">
                <Stat
                  label="Goals reached"
                  value={`${goalsReached}/${goalSkills.length}`}
                />
                <Stat label="Steps on route" value={String(data.totalSteps)} />
                <Stat label="Hours to go" value={String(data.totalHours)} />
                <Stat
                  label="Milestones"
                  value={String(data.milestones.length)}
                />
              </dl>
            </section>

            {data.nextAction && (
              <section aria-labelledby="next">
                <h2
                  id="next"
                  className="mb-3 font-[family-name:var(--font-display)] text-xl font-semibold"
                >
                  Do this next
                </h2>
                <div className="border-route bg-accent/30 rounded-r-md border-l-2 p-4">
                  <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
                    {data.nextAction.resource.title}
                  </p>
                  <p className="text-ink-muted mt-0.5 font-mono text-xs">
                    {data.nextAction.resource.provider} ·{" "}
                    {data.nextAction.resource.estHours}h
                  </p>
                  <p className="mt-2 text-sm">
                    {whySentence(data.nextAction.reasons)}
                  </p>
                  <a
                    href={data.nextAction.resource.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-route-ink focus-visible:ring-ring mt-3 inline-block text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    Open it
                  </a>
                </div>
              </section>
            )}

            <section aria-labelledby="skills">
              <h2
                id="skills"
                className="mb-3 font-[family-name:var(--font-display)] text-xl font-semibold"
              >
                Skill development
              </h2>
              {goalSkills.length > 0 && (
                <>
                  <p className="text-ink-muted mb-1 text-xs tracking-wide uppercase">
                    Destination
                  </p>
                  <ul className="border-hairline mb-5 divide-y">
                    {goalSkills.map((s) => (
                      <SkillMeter key={s.skillId} {...s} />
                    ))}
                  </ul>
                </>
              )}
              {supporting.length > 0 ? (
                <>
                  <p className="text-ink-muted mb-1 text-xs tracking-wide uppercase">
                    Picked up along the way
                  </p>
                  <ul className="border-hairline divide-y">
                    {supporting.map((s) => (
                      <SkillMeter key={s.skillId} {...s} />
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-ink-muted text-sm">
                  Nothing recorded yet. Mark a step finished on your route and
                  it shows up here.
                </p>
              )}
            </section>

            {data.milestones.length > 0 && (
              <section aria-labelledby="milestones">
                <h2
                  id="milestones"
                  className="mb-3 font-[family-name:var(--font-display)] text-xl font-semibold"
                >
                  Milestones ahead
                </h2>
                <ol className="space-y-2">
                  {data.milestones.map((m) => (
                    <li
                      key={m.position}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span
                        aria-hidden="true"
                        className="border-route-ink size-2.5 rotate-45 border"
                      />
                      <span>{m.label.replace(/^Milestone:\s*/i, "")}</span>
                      <span className="text-ink-muted ml-auto font-mono text-xs">
                        step {m.position}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {data.activity.length > 0 && (
              <section aria-labelledby="activity">
                <h2
                  id="activity"
                  className="mb-3 font-[family-name:var(--font-display)] text-xl font-semibold"
                >
                  Recent activity
                </h2>
                <ul className="text-ink-muted space-y-1.5 text-sm">
                  {data.activity.map((event, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="text-ink">{verb(event.type)}</span>
                      <span className="font-mono text-xs">
                        {event.resourceId}
                      </span>
                      <span className="ml-auto font-mono text-xs">
                        {new Date(event.at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
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

function whySentence(reasons: Reasons): string {
  const covers = reasons.coversGapSkills;
  if (covers.length === 0) return "Consolidates what you have already covered.";
  const names = covers.map((c) => c.name);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `Builds ${list} — the next thing your goal depends on.`;
}

function verb(type: string): string {
  if (type === "done") return "Finished";
  if (type === "struggled") return "Struggled with";
  if (type === "skipped") return "Skipped";
  return type;
}
