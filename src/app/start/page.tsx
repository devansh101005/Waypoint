"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AskPanel } from "@/components/ask-panel";
import { ReadingStrip, TransitBar } from "@/components/transit/chrome";
import { rememberRoute } from "@/lib/learner-memory";
import { TransitRoute, type RouteStop } from "@/components/transit/route";
import { INK, LINE, LINE_INK, PAPER } from "@/components/transit/theme";
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
  items: RouteStop[];
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

  /** Synchronous, unlike the `planning` state the button is disabled from. */
  const inFlight = useRef(false);

  async function plotRoute() {
    if (!learnerId || inFlight.current) return;
    inFlight.current = true;
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
      rememberRoute(data.learnerId, profile?.goalSummary || "Your route");
    } catch {
      setError("Could not reach the planner.");
    } finally {
      inFlight.current = false;
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
    <div className="min-h-screen" style={{ background: PAPER, color: INK }}>
      <TransitBar line="INTAKE" />

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="wp-display text-[clamp(2rem,5vw,3.2rem)] leading-[0.95] font-extrabold tracking-[-0.02em]">
          TELL ME WHERE
          <br />
          YOU WANT TO GET TO
        </h1>

        <div className="mt-9 grid gap-8 lg:grid-cols-[1fr_19rem]">
          <section aria-labelledby="conversation" className="min-w-0">
            <h2 id="conversation" className="sr-only">
              Conversation
            </h2>

            <div className="border-[3px]" style={{ borderColor: INK }}>
              <div className="max-h-[24rem] space-y-4 overflow-y-auto p-5" aria-live="polite">
                {messages.map((message, i) => (
                  <div
                    key={i}
                    className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <p
                      className="max-w-[88%] px-3.5 py-2.5 text-sm leading-relaxed"
                      style={
                        message.role === "user"
                          ? { background: INK, color: PAPER }
                          : { border: `2px solid ${INK}` }
                      }
                    >
                      {message.content}
                    </p>
                  </div>
                ))}
                {thinking && (
                  <p
                    className="font-mono text-sm tracking-[0.08em]"
                    style={{ color: LINE_INK.data }}
                  >
                    {
                      [
                        "READING THAT",
                        "MATCHING AGAINST THE NETWORK",
                        "WORKING OUT WHICH SKILLS THAT NEEDS",
                        "RESOLVING PREREQUISITES",
                      ][stage]
                    }
                    <span className="wp-ellipsis" />
                  </p>
                )}
                <div ref={endRef} />
              </div>

              <div className="border-t-[3px] p-3" style={{ borderColor: INK }}>
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
                    className="min-w-0 flex-1 border-2 px-3 py-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ borderColor: INK, background: PAPER, outlineColor: LINE.data }}
                  />
                  <button
                    type="submit"
                    disabled={thinking || !input.trim()}
                    className="wp-press px-5 py-2 text-sm font-bold tracking-[0.14em] disabled:opacity-45"
                    style={{ background: INK, color: PAPER }}
                  >
                    SEND
                  </button>
                </form>
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-3 text-sm" style={{ color: LINE_INK.data }}>
                {error}{" "}
                <Link href="/plan" className="underline underline-offset-4">
                  Plot a route by hand instead
                </Link>
                .
              </p>
            )}

            {ready && !path && (
              <button
                type="button"
                onClick={plotRoute}
                disabled={planning}
                className="wp-press mt-6 px-6 py-3 text-sm font-bold tracking-[0.16em] disabled:opacity-50"
                style={{ background: LINE_INK.data, color: PAPER }}
              >
                {planning ? (
                  <>
                    PLOTTING ROUTE<span className="wp-ellipsis" />
                  </>
                ) : (
                  "PLOT MY ROUTE"
                )}
              </button>
            )}
          </section>

          <aside aria-labelledby="profile" className="lg:sticky lg:top-8 lg:self-start">
            <h2
              id="profile"
              className="mb-3 flex items-center gap-2 font-mono text-[0.66rem] font-bold tracking-[0.18em]"
            >
              WHAT I HAVE SO FAR
              {provisional && <span style={{ color: LINE_INK.accent }}>· FIRST READ</span>}
            </h2>

            <div className="space-y-5 border-2 p-4 text-sm" style={{ borderColor: INK }}>
              {!profile ? (
                <p className="opacity-70">
                  Nothing yet. Describe where you want to get to and this fills in.
                </p>
              ) : (
                <>
                  {profile.goalSummary && (
                    <p className="leading-relaxed">{profile.goalSummary}</p>
                  )}

                  <Group label="DESTINATION" empty="not identified yet">
                    {profile.goalSkills.map((s) => (
                      <Station key={s.skillId} accent>
                        {s.name} <span className="font-mono text-[0.68rem]">L{s.level}</span>
                      </Station>
                    ))}
                  </Group>

                  <Group label="STATIONS ALREADY PASSED" empty="nothing mentioned">
                    {profile.statedSkills.map((s) => (
                      <Station key={s.skillId}>
                        {s.name} <span className="font-mono text-[0.68rem]">L{s.level}</span>
                      </Station>
                    ))}
                  </Group>

                  {(profile.constraints.hoursPerWeek || profile.constraints.deadlineWeeks) && (
                    <Group label="SERVICE PATTERN" empty="">
                      {profile.constraints.hoursPerWeek && (
                        <Station>{profile.constraints.hoursPerWeek}h per week</Station>
                      )}
                      {profile.constraints.deadlineWeeks && (
                        <Station>{profile.constraints.deadlineWeeks} weeks</Station>
                      )}
                    </Group>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>

        {path && (
          <>
            <section aria-labelledby="summary" className="mt-12">
              <h2 id="summary" className="sr-only">
                Route summary
              </h2>
              <ReadingStrip
                readings={[
                  { label: "STOPS", value: String(path.items.length) },
                  { label: "HOURS", value: String(path.totalHours), accent: true },
                  { label: "REACHES GOAL", value: path.complete ? "YES" : "PARTLY" },
                  { label: "VIOLATIONS", value: "0" },
                ]}
              />
            </section>

            {path.diff && path.diff.summary !== "Your path is unchanged." && (
              <p
                aria-live="polite"
                className="mt-6 py-2 pl-4 text-sm"
                style={{ borderLeft: `4px solid ${LINE.accent}` }}
              >
                <span
                  className="block font-mono text-[0.66rem] font-bold tracking-[0.18em]"
                  style={{ color: LINE_INK.accent }}
                >
                  ROUTE UPDATED
                </span>
                <span className="mt-1 block">{path.diff.summary}</span>
              </p>
            )}

            <section aria-labelledby="route" className="mt-10">
              <h2
                id="route"
                className="wp-display mb-6 text-[clamp(1.5rem,3.5vw,2.2rem)] leading-none font-extrabold tracking-[-0.02em]"
              >
                YOUR ROUTE
              </h2>
              <TransitRoute
                stops={path.items}
                pathId={path.pathId}
                onFeedback={sendFeedback}
                busyResourceId={busy}
                changedResourceIds={changed}
              />
            </section>

            <AskPanel pathId={path.pathId} />

            <p className="mt-10 font-mono text-[0.75rem] tracking-[0.08em]">
              <Link
                href={`/dashboard/${path.learnerId}`}
                className="underline underline-offset-4"
              >
                SEE YOUR POSITION ON THE NETWORK →
              </Link>
            </p>
          </>
        )}
      </main>
    </div>
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
      <p className="mb-2 font-mono text-[0.62rem] font-bold tracking-[0.16em] opacity-70">
        {label}
      </p>
      {isEmpty ? (
        <p className="font-mono text-[0.7rem] opacity-70">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">{children}</ul>
      )}
    </div>
  );
}

/** A skill as a station: a ring for one already passed, a diamond for a destination. */
function Station({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <li
      className="flex items-center gap-1.5 border-2 px-2.5 py-1 text-xs"
      style={{ borderColor: accent ? LINE.data : "rgba(22,22,26,0.3)" }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: accent ? 0 : "999px",
          transform: accent ? "rotate(45deg)" : undefined,
          background: accent ? LINE.data : "transparent",
          border: accent ? undefined : `2px solid ${INK}`,
        }}
      />
      {children}
    </li>
  );
}

function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
