"use client";

import { useState } from "react";

/**
 * Questions about the plan on screen.
 *
 * Deliberately narrow: this answers from the learner's own route, not from the
 * whole catalogue and not from the model's general knowledge. When an answer
 * strays outside the plan the server says so, and we mark it, because an
 * answer the learner cannot check against what is in front of them is worth
 * less than one they can.
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
    <section aria-labelledby="ask" className="mt-10">
      <h2
        id="ask"
        className="mb-3 font-[family-name:var(--font-display)] text-xl font-semibold"
      >
        Ask about your route
      </h2>

      {history.length > 0 && (
        <ul className="mb-4 space-y-4" aria-live="polite">
          {history.map((exchange, i) => (
            <li key={i}>
              <p className="text-ink-muted text-sm">{exchange.question}</p>
              <p className="border-route mt-1 border-l-2 py-1 pl-4 text-sm">
                {exchange.answer}
              </p>
              {!exchange.grounded && (
                <p className="text-ink-muted mt-1 pl-4 text-xs italic">
                  This answer mentions something outside your plan — treat it
                  with care.
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
        className="flex gap-2"
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
          className="border-hairline bg-paper focus-visible:ring-ring min-w-0 flex-1 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={asking || !question.trim()}
          className="border-hairline hover:border-route focus-visible:ring-ring rounded-md border px-4 py-2 text-sm disabled:opacity-50 focus-visible:ring-2 focus-visible:outline-none"
        >
          {asking ? "Thinking…" : "Ask"}
        </button>
      </form>

      {history.length === 0 && !asking && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => void ask(suggestion)}
                className="border-hairline hover:border-route text-ink-muted focus-visible:ring-ring rounded-full border px-3 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
