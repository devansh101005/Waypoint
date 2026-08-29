"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AskPanel } from "@/components/ask-panel";
import { PathRoute, type RouteItem } from "@/components/path-route";
import { quickMatch, type MatchableSkill } from "@/lib/quickmatch";
import type { PathDiff } from "@/lib/types";

/**
 * Conversational intake.
 *
 * The learner describes their goal in their own words; every turn is compiled
 * into a structured profile against the canonical skill graph, and that profile
 * is shown filling in beside the conversation. Seeing the model commit to
 * specific skills — rather than nodding along in prose — is what makes it
 * legible that something is actually being built from what they said.
 */

interface SkillChip {
  skillId: string;
  name: string;
  level: number;
}

interface Profile {
  goalSummary: string;
  goalSkills: SkillChip[];
  statedSkills: SkillChip[];
  constraints: {
    hoursPerWeek?: number;
    deadlineWeeks?: number;
    formats?: string[];
  };
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PathResponse {
  pathId: string;
  learnerId: string;
  complete: boolean;
  totalHours: number;
  items: RouteItem[];
  gap: Array<{
    skillId: string;
    name: string;
    currentLevel: number;
    targetLevel: number;
    isGoal: boolean;
  }>;
  diff: PathDiff | null;
  detail?: string;
}

const OPENING =
  "What do you want to be able to do? Tell me the goal in your own words — and mention anything you already know, plus how much time you can give it.";

export default function StartPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: OPENING },
  ]);
  const [input, setInput] = useState("");
  const [learnerId, setLearnerId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [path, setPath] = useState<PathResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<MatchableSkill[]>([]);
  const [provisional, setProvisional] = useState(false);
  const [stage, setStage] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  // The catalogue powers the instant local read while the model is thinking.
  useEffect(() => {
    fetch("/api/demo")
      .then((r) => r.json())
      .then((data) => setCatalogue(data.skills ?? []))
      .catch(() => {
        /* the model still works without it */
      });
  }, []);

  // The gateway takes 20-50s. Say what is happening instead of showing a dot.
  useEffect(() => {
    if (!thinking) {
      setStage(0);
      return;
    }
    const timers = [
      setTimeout(() => setStage(1), 2500),
      setTimeout(() => setStage(2), 9000),
      setTimeout(() => setStage(3), 18000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [thinking]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, thinking]);

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;

    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setThinking(true);
    setError("");

    /**
     * A first read, computed here and now. The model's answer is better and
     * replaces this the moment it lands, but the learner sees the skill graph
     * responding to their words immediately rather than after half a minute.
     */
    if (catalogue.length > 0) {
      const guess = quickMatch(text, catalogue);
      const name = (id: string) => catalogue.find((s) => s.id === id)?.name ?? id;
      if (guess.goalSkills.length > 0 || guess.statedSkills.length > 0) {
        setProvisional(true);
        setProfile((current) => ({
          goalSummary: current?.goalSummary ?? "",
          goalSkills:
            guess.goalSkills.length > 0
              ? guess.goalSkills.map((g) => ({ ...g, name: name(g.skillId) }))
              : (current?.goalSkills ?? []),
          statedSkills:
            guess.statedSkills.length > 0
              ? guess.statedSkills.map((g) => ({ ...g, name: name(g.skillId) }))
              : (current?.statedSkills ?? []),
          constraints: {
            ...current?.constraints,
            ...(guess.hoursPerWeek ? { hoursPerWeek: guess.hoursPerWeek } : {}),
            ...(guess.deadlineWeeks ? { deadlineWeeks: guess.deadlineWeeks } : {}),
          },
        }));
      }
    }

    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerId: learnerId ?? undefined,
          messages: next.filter((m) => m.content !== OPENING),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(
          data.hint ??
            data.detail ??
            "The assistant is unavailable. You can still plan a route by hand.",
        );
        return;
      }

      setLearnerId(data.learnerId);
      setProfile(data.profile);
      setProvisional(false);
      setReady(data.ready);

      const reply =
        data.followUpQuestion ??
        (data.ready
          ? `Got it — ${lower(data.profile.goalSummary)} I have what I need. Plot the route when you are ready.`
          : "Tell me a little more about what you want to be able to do.");
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch {
      setError(
        "Could not reach the assistant. You can still plan a route by hand.",
      );
    } finally {
      setThinking(false);
    }
  }

  async function plotRoute() {
    if (!learnerId) return;
    setPlanning(true);
    setError("");
    try {
      const response = await fetch("/api/paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learnerId }),
      });
      const data: PathResponse = await response.json();
      if (!response.ok) {
        setError(data.detail ?? "Could not plot a route.");
        return;
      }
      setPath(data);
    } catch {
      setError("Could not reach the planner.");
    } finally {
      setPlanning(false);
    }
  }

  async function sendFeedback(resourceId: string, event: "done" | "struggled") {
    if (!path || !learnerId) return;
    setBusy(resourceId);
    try {
      const response = await fetch("/api/paths/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerId,
          pathId: path.pathId,
          resourceId,
          event,
        }),
      });
      const data: PathResponse = await response.json();
      if (!response.ok) {
        setError(data.detail ?? "Could not update your route.");
        return;
      }
      setPath(data);
    } finally {
      setBusy(null);
    }
  }

  const changed = new Set(path?.diff?.added.map((a) => a.resourceId) ?? []);

  return (
    <main className="relative min-h-screen">
      <div
        aria-hidden="true"
        className="survey-ground pointer-events-none absolute inset-0 opacity-[0.18]"
      />

      <div className="relative mx-auto max-w-5xl px-6 py-12">
        <header className="mb-8">
          <Link
            href="/"
            className="text-ink-muted hover:text-ink text-xs tracking-[0.2em] uppercase"
          >
            Waypoint
          </Link>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl leading-tight font-semibold text-balance">
            Tell me where you want to get to
          </h1>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          {/* conversation */}
          <section aria-labelledby="conversation" className="min-w-0">
            <h2 id="conversation" className="sr-only">
              Conversation
            </h2>

            <div className="border-hairline bg-paper-raised rounded-lg border">
              <div
                className="max-h-[26rem] space-y-4 overflow-y-auto p-5"
                aria-live="polite"
              >
                {messages.map((message, i) => (
                  <div
                    key={i}
                    className={
                      message.role === "user"
                        ? "flex justify-end"
                        : "flex justify-start"
                    }
                  >
                    <p
                      className={
                        message.role === "user"
                          ? "bg-secondary max-w-[85%] rounded-lg rounded-br-sm px-3.5 py-2.5 text-sm"
                          : "border-hairline max-w-[90%] rounded-lg rounded-bl-sm border px-3.5 py-2.5 text-sm"
                      }
                    >
                      {message.content}
                    </p>
                  </div>
                ))}
                {thinking && (
                  <p className="text-ink-muted text-sm italic">
                    {
                      [
                        "Reading that…",
                        "Matching it against the skill graph…",
                        "Working out which skills that really needs…",
                        "Almost there — resolving prerequisites…",
                      ][stage]
                    }
                  </p>
                )}
                <div ref={endRef} />
              </div>

              <div className="border-hairline border-t p-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                  className="flex gap-2"
                >
                  <label htmlFor="message" className="sr-only">
                    Your message
                  </label>
                  <input
                    id="message"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="I want to become a data analyst…"
                    disabled={thinking}
                    className="border-hairline bg-paper focus-visible:ring-ring min-w-0 flex-1 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={thinking || !input.trim()}
                    className="bg-primary text-primary-foreground focus-visible:ring-ring rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-destructive mt-3 text-sm">
                {error}{" "}
                <Link href="/plan" className="underline underline-offset-4">
                  Plan a route by hand instead
                </Link>
                .
              </p>
            )}

            {ready && !path && (
              <button
                type="button"
                onClick={plotRoute}
                disabled={planning}
                className="bg-primary text-primary-foreground focus-visible:ring-ring mt-5 rounded-md px-4 py-2.5 text-sm font-medium disabled:opacity-50 focus-visible:ring-2 focus-visible:outline-none"
              >
                {planning ? "Plotting…" : "Plot my route"}
              </button>
            )}
          </section>

          {/* profile, filling in as they talk */}
          <aside
            aria-labelledby="profile"
            className="lg:sticky lg:top-8 lg:self-start"
          >
            <h2
              id="profile"
              className="text-ink-muted mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase"
            >
              What I have so far
              {provisional && (
                <span className="text-route-ink normal-case tracking-normal italic">
                  first read
                </span>
              )}
            </h2>

            <div className="border-hairline bg-paper-raised space-y-4 rounded-lg border p-4 text-sm">
              {!profile ? (
                <p className="text-ink-muted">
                  Nothing yet. Describe your goal and this fills in.
                </p>
              ) : (
                <>
                  {profile.goalSummary && <p>{profile.goalSummary}</p>}

                  <Group label="Destination" empty="not identified yet">
                    {profile.goalSkills.map((s) => (
                      <Chip key={s.skillId} accent>
                        {s.name}{" "}
                        <span className="font-mono text-[0.7rem]">
                          L{s.level}
                        </span>
                      </Chip>
                    ))}
                  </Group>

                  <Group label="Already has" empty="nothing mentioned">
                    {profile.statedSkills.map((s) => (
                      <Chip key={s.skillId}>
                        {s.name}{" "}
                        <span className="font-mono text-[0.7rem]">
                          L{s.level}
                        </span>
                      </Chip>
                    ))}
                  </Group>

                  {(profile.constraints.hoursPerWeek ||
                    profile.constraints.deadlineWeeks) && (
                    <Group label="Time" empty="">
                      {profile.constraints.hoursPerWeek && (
                        <Chip>
                          {profile.constraints.hoursPerWeek}h per week
                        </Chip>
                      )}
                      {profile.constraints.deadlineWeeks && (
                        <Chip>{profile.constraints.deadlineWeeks} weeks</Chip>
                      )}
                    </Group>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>

        {path && (
          <section aria-labelledby="route" className="mt-12">
            <div className="border-hairline mb-6 flex flex-wrap gap-x-8 gap-y-3 border-y py-4">
              <Stat label="Steps" value={String(path.items.length)} />
              <Stat label="Hours" value={String(path.totalHours)} />
              <Stat
                label="Reaches goal"
                value={path.complete ? "yes" : "partly"}
              />
            </div>

            {path.diff && path.diff.summary !== "Your path is unchanged." && (
              <p
                aria-live="polite"
                className="border-route bg-accent/40 mb-6 rounded-r-md border-l-2 py-3 pr-4 pl-4 text-sm"
              >
                <span className="text-route-ink block text-xs font-semibold tracking-[0.18em] uppercase">
                  Route updated
                </span>
                <span className="mt-1 block">{path.diff.summary}</span>
              </p>
            )}

            <h2
              id="route"
              className="mb-5 font-[family-name:var(--font-display)] text-xl font-semibold"
            >
              Your route
            </h2>
            <PathRoute
              items={path.items}
              pathId={path.pathId}
              onFeedback={sendFeedback}
              busyResourceId={busy}
              changedResourceIds={changed}
            />

            <AskPanel pathId={path.pathId} />

            <p className="text-ink-muted mt-8 text-sm">
              <Link
                href={`/dashboard/${path.learnerId}`}
                className="text-foreground underline underline-offset-4"
              >
                See your dashboard
              </Link>{" "}
              for progress, skills and milestones.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

function Group({
  label,
  empty,
  children,
}: {
  label: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const isEmpty = items.filter(Boolean).length === 0;
  if (isEmpty && !empty) return null;

  return (
    <div>
      <p className="text-ink-muted mb-1.5 text-xs tracking-wide uppercase">
        {label}
      </p>
      {isEmpty ? (
        <p className="text-ink-muted text-xs italic">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">{children}</ul>
      )}
    </div>
  );
}

function Chip({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <li
      className={
        accent
          ? "border-route text-route-ink rounded-full border px-2.5 py-1 text-xs"
          : "border-hairline rounded-full border px-2.5 py-1 text-xs"
      }
    >
      {children}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-ink-muted text-xs tracking-wide uppercase">{label}</p>
      <p className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        {value}
      </p>
    </div>
  );
}

function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1).replace(/\.$/, ".");
}
