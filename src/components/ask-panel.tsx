"use client";

import { useState } from "react";
import { INK, LINE, LINE_INK, PAPER } from "@/components/transit/theme";

/**
 * Questions about the route on screen.
 *
 * Deliberately narrow: this answers from the learner's own plan, not from the
 * whole catalogue and not from the model's general knowledge. When an answer
 * strays outside the plan the server says so and it is marked, because an
 * answer nobody can check against what is in front of them is worth less than
 * one they can.
 */

interface Exchange {
  question: string;
  answer: string;
  grounded: boolean;
}

const SUGGESTIONS = [
  "Why is the first step first?",
  "What happens if I skip step 2?",
  "How long until the first milestone?",
];

export function AskPanel({ pathId }: { pathId: string }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || asking) return;

    setAsking(true);
    setError("");
    setQuestion("");
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathId, question: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(
          data.hint ?? data.detail ?? "Could not answer that right now.",
        );
        return;
      }
      setHistory((current) => [
        ...current,
        { question: trimmed, answer: data.answer, grounded: data.grounded },
      ]);
    } catch {
      setError("Could not reach the assistant.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <section aria-labelledby="ask" className="mt-12">
      <h2
        id="ask"
        className="wp-display mb-5 text-[clamp(1.3rem,3vw,1.9rem)] font-extrabold tracking-[-0.01em]"
      >
        ASK ABOUT YOUR ROUTE
      </h2>

      {history.length > 0 && (
        <ul className="mb-5 space-y-5" aria-live="polite">
          {history.map((exchange, i) => (
            <li key={i}>
              <p className="font-mono text-[0.72rem] tracking-[0.1em] opacity-70">
                {exchange.question.toUpperCase()}
              </p>
              <p
                className="mt-1.5 py-1 pl-4 text-sm leading-relaxed"
                style={{ borderLeft: `3px solid ${LINE.data}` }}
              >
                {exchange.answer}
              </p>
              {!exchange.grounded && (
                <p
                  className="mt-1 pl-4 font-mono text-[0.68rem]"
                  style={{ color: LINE_INK.accent }}
                >
                  ⚠ MENTIONS SOMETHING OUTSIDE YOUR PLAN — TREAT WITH CARE
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="flex flex-wrap gap-2"
      >
        <label htmlFor="question" className="sr-only">
          Your question about this route
        </label>
        <input
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Why is this step before that one?"
          disabled={asking}
          className="min-w-0 flex-1 border-2 px-3 py-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            borderColor: INK,
            background: PAPER,
            outlineColor: LINE.data,
          }}
        />
        <button
          type="submit"
          disabled={asking || !question.trim()}
          className="wp-press px-5 py-2 text-sm font-bold tracking-[0.14em] disabled:opacity-45"
          style={{ background: INK, color: PAPER }}
        >
          {asking ? (
            <>
              THINKING
              <span className="wp-ellipsis" />
            </>
          ) : (
            "ASK"
          )}
        </button>
      </form>

      {history.length === 0 && !asking && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => void ask(suggestion)}
                className="border-2 px-3 py-1 font-mono text-[0.65rem] tracking-[0.1em] transition-colors hover:opacity-70"
                style={{ borderColor: "rgba(22,22,26,0.28)", color: INK }}
              >
                {suggestion.toUpperCase()}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 text-sm"
          style={{ color: LINE_INK.data }}
        >
          {error}
        </p>
      )}
    </section>
  );
}
