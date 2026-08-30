"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ReadingStrip, TransitBar } from "@/components/transit/chrome";
import { SkillLine } from "@/components/transit/skill-line";
import { INK, LINE, LINE_INK, PAPER } from "@/components/transit/theme";
import type { Reasons } from "@/lib/types";

/**
 * Where the learner stands, drawn as position on a line.
 *
 * Everything here comes from the same plan the route view renders, so the two
 * can never disagree. Progress is shown as stations passed rather than as a
 * percentage: the underlying data is a sequence of discrete stops, and a ring
 * chart would be inventing a continuous quantity that does not exist.
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
  const reached = goalSkills.filter(
    (s) => s.targetLevel !== null && s.level >= s.targetLevel,
  ).length;

  return (
    <div className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <TransitBar line="YOUR POSITION" />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="wp-display text-[clamp(2rem,5vw,3.2rem)] leading-[0.95] font-extrabold tracking-[-0.02em]">
          WHERE YOU STAND
        </h1>
        {data?.goalSummary && (
          <p className="mt-4 max-w-2xl leading-relaxed">{data.goalSummary}</p>
        )}

        {status === "loading" && (
          <p className="mt-8 font-mono text-sm">
            LOADING YOUR POSITION
            <span className="wp-ellipsis" />
          </p>
        )}

        {status === "missing" && (
          <p
            className="mt-8 border-2 border-dashed p-6 text-sm"
            style={{ borderColor: INK }}
          >
            No learner with that id. This happens after a restart when no
            database is configured.{" "}
            <Link href="/start" className="underline underline-offset-4">
              Start a new plan
            </Link>
            .
          </p>
        )}

        {status === "error" && (
          <p
            role="alert"
            className="mt-8 text-sm"
            style={{ color: LINE_INK.data }}
          >
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
          <div className="mt-8 space-y-12">
            <section aria-labelledby="summary">
              <h2 id="summary" className="sr-only">
                Summary
              </h2>
              <ReadingStrip
                readings={[
                  {
                    label: "DESTINATIONS REACHED",
                    value: `${reached}/${goalSkills.length}`,
                  },
                  { label: "STOPS AHEAD", value: String(data.totalSteps) },
                  {
                    label: "HOURS TO GO",
                    value: String(data.totalHours),
                    accent: true,
                  },
                  {
                    label: "INTERCHANGES",
                    value: String(data.milestones.length),
                  },
                ]}
              />
            </section>

            {data.nextAction && (
              <section aria-labelledby="next">
                <h2
                  id="next"
                  className="wp-display mb-4 text-[clamp(1.3rem,3vw,1.9rem)] font-extrabold tracking-[-0.01em]"
                >
                  NEXT STOP
                </h2>
                <div
                  className="p-5"
                  style={{
                    borderLeft: `6px solid ${LINE.data}`,
                    background: "rgba(22,22,26,0.03)",
                  }}
                >
                  <p className="wp-display text-xl font-bold uppercase">
                    {data.nextAction.resource.title}
                  </p>
                  <p className="mt-1 font-mono text-[0.75rem] tabular-nums opacity-70">
                    {data.nextAction.resource.provider} ·{" "}
                    {data.nextAction.resource.estHours}h
                  </p>
                  <p className="mt-3 text-sm leading-relaxed">
                    {why(data.nextAction.reasons)}
                  </p>
                  <a
                    href={data.nextAction.resource.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-4 inline-block font-mono text-[0.7rem] font-bold tracking-[0.14em] underline underline-offset-4"
                    style={{ color: LINE_INK.data }}
                  >
                    OPEN IT ↗
                  </a>
                </div>
              </section>
            )}

            <section aria-labelledby="skills">
              <h2
                id="skills"
                className="wp-display mb-5 text-[clamp(1.3rem,3vw,1.9rem)] font-extrabold tracking-[-0.01em]"
              >
                SKILL DEVELOPMENT
              </h2>

              {goalSkills.length > 0 && (
                <>
                  <p className="mb-1 font-mono text-[0.66rem] font-bold tracking-[0.18em] opacity-70">
                    DESTINATION
                  </p>
                  <ul
                    className="mb-7 divide-y"
                    style={{ borderColor: "rgba(22,22,26,0.14)" }}
                  >
                    {goalSkills.map((s) => (
                      <SkillLine key={s.skillId} {...s} />
                    ))}
                  </ul>
                </>
              )}

              {supporting.length > 0 ? (
                <>
                  <p className="mb-1 font-mono text-[0.66rem] font-bold tracking-[0.18em] opacity-70">
                    STATIONS PASSED ALONG THE WAY
                  </p>
                  <ul
                    className="divide-y"
                    style={{ borderColor: "rgba(22,22,26,0.14)" }}
                  >
                    {supporting.map((s) => (
                      <SkillLine key={s.skillId} {...s} />
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm opacity-70">
                  Nothing recorded yet. Mark a stop finished on your route and
                  it appears here.
                </p>
              )}
            </section>

            {data.milestones.length > 0 && (
              <section aria-labelledby="milestones">
                <h2
                  id="milestones"
                  className="wp-display mb-4 text-[clamp(1.3rem,3vw,1.9rem)] font-extrabold tracking-[-0.01em]"
                >
                  INTERCHANGES AHEAD
                </h2>
                <ol className="space-y-3">
                  {data.milestones.map((m) => (
                    <li
                      key={m.position}
                      className="flex items-center gap-4 text-sm"
                    >
                      <span
                        aria-hidden="true"
                        className="shrink-0"
                        style={{
                          width: 13,
                          height: 13,
                          transform: "rotate(45deg)",
                          border: `3px solid ${LINE_INK.data}`,
                        }}
                      />
                      <span className="wp-display font-bold uppercase">
                        {m.label.replace(/^Milestone:\s*/i, "")}
                      </span>
                      <span className="ml-auto font-mono text-xs tabular-nums opacity-65">
                        STOP {m.position}
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
                  className="wp-display mb-4 text-[clamp(1.3rem,3vw,1.9rem)] font-extrabold tracking-[-0.01em]"
                >
                  SERVICE LOG
                </h2>
                <ul className="space-y-2">
                  {data.activity.map((event, i) => (
                    <li key={i} className="flex gap-4 font-mono text-[0.75rem]">
                      <span
                        className="font-bold tracking-[0.1em]"
                        style={{
                          color:
                            event.type === "struggled" ? LINE_INK.data : INK,
                        }}
                      >
                        {verb(event.type)}
                      </span>
                      <span className="opacity-70">{event.resourceId}</span>
                      <span className="ml-auto tabular-nums opacity-70">
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
      </main>
    </div>
  );
}

function why(reasons: Reasons): string {
  const covers = reasons.coversGapSkills;
  if (covers.length === 0) return "Consolidates what you have already covered.";
  const names = covers.map((c) => c.name);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `Builds ${list} — the next thing your destination depends on.`;
}

function verb(type: string): string {
  if (type === "done") return "FINISHED";
  if (type === "struggled") return "STRUGGLED";
  if (type === "skipped") return "SKIPPED";
  return type.toUpperCase();
}
