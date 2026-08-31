# PROGRESS

Updated at every phase gate. Times IST.

## Status: all six features complete, evaluated against the curated corpus, deployed

**Last update:** Mon 31 Aug, ~00:45
**Code freeze:** passed (Sun 30 Aug 21:00). Remaining work is deliverables and P0 fixes only.
**Deployed:** https://waypoint-six-teal.vercel.app — public repo, all routes 200
**Cut ladder:** nothing fired

## Done and verified

| Item                                         | Evidence                                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Planning docs 00-04                          | `docs/`                                                                                                         |
| Verification hooks (4)                       | Tested block + allow; have caught 11 real defects                                                               |
| verify-feature skill + skeptic agent         | `.claude/skills/`, `.claude/agents/`                                                                            |
| Next.js 16 + TS + Tailwind + shadcn scaffold | `npm run build` passes                                                                                          |
| DB schema (11 tables, pgvector)              | `src/db/schema.ts`                                                                                              |
| LLM adapter (Rikko, OpenAI-compatible)       | `src/lib/llm.ts` — Zod-validated extraction + retry                                                             |
| Embeddings adapter (Cohere v2)               | `src/lib/embeddings.ts` — degrades without a key                                                                |
| Corpus parser + validator                    | `src/lib/corpus.ts` — 21 tests                                                                                  |
| Import script                                | Validates before writing; row-numbered error reports                                                            |
| **Skill graph (DAG)**                        | `src/lib/graph.ts` — ancestors, depth, topo order, cycle detection                                              |
| **Mastery model**                            | `src/lib/mastery.ts` — completion, struggle, quiz, downward propagation                                         |
| **Gap compiler**                             | `src/lib/gap.ts` — goal-state delta over the DAG, frontier, gap card                                            |
| **Hybrid scorer**                            | `src/lib/scoring.ts` — tag/dense/lexical with weight renormalisation                                            |
| **DAG-constrained planner**                  | `src/lib/planner.ts` — beam search, milestones, reasons objects                                                 |
| **Evaluation metrics**                       | `src/lib/eval.ts` — violations, coverage, redundancy, nDCG, Kendall tau                                         |
| **Similarity baseline**                      | `src/lib/baseline.ts` — the "LLM wrapper" approach, implemented fairly                                          |
| **Eval harness**                             | `npm run eval` — 10 scenarios, markdown + JSON output                                                           |
| **Explanation layer**                        | `src/lib/explain.ts` — LLM phrasing + hallucination guard + template fallback                                   |
| **Intake extraction**                        | `src/lib/intake.ts` — enum-constrained to the skill graph                                                       |
| **Store abstraction**                        | `src/lib/store.ts` — in-memory from CSV; the app runs with no database at all                                   |
| **Postgres store**                           | `src/lib/store-postgres.ts` — selected automatically when `DATABASE_URL` is set                                 |
| Persistence proven                           | Learner, path and events survived a full server restart                                                         |
| Curated corpus imported                      | 65 skills · 126 resources · 10 scenarios, live in Postgres                                                      |
| **Corpus audit**                             | `npm run audit` — teachability, reachability, ceilings, shape                                                   |
| **Transit-map interface**                    | Shared route component across landing, `/plan`, `/start`, `/dashboard`                                          |
| Accessibility                                | Lighthouse **100** on `/`, `/start`, `/eval` (also BP 100, SEO 100, Agentic 100)                                |
| Motion verified in-browser                   | Route draw-in, re-plot diff choreography, metric count-up, `prefers-reduced-motion` all measured frame-by-frame |
| Responsive                                   | No horizontal overflow across 4 pages × 390/768/1280/1920                                                       |

**Test suite: 181 passing** (corpus 21, graph/gap/mastery 22, planner/scoring 31, eval/baseline 23,
explain/intake 30, ask 10, quickmatch 11, service 23, postgres integration 9, alias guard 1).
The Postgres tests skip themselves when `DATABASE_URL` is absent, so a clean checkout still passes.

### Required features: 6/6

| #   | Feature                                          | Where                                        |
| --- | ------------------------------------------------ | -------------------------------------------- |
| 1   | Conversational interface                         | `/start`                                     |
| 2   | Learner profiling engine                         | `/start` profile panel, `src/lib/mastery.ts` |
| 3   | Recommendation engine                            | `src/lib/scoring.ts`                         |
| 4   | Path generator with prerequisites and milestones | `src/lib/planner.ts`, route view             |
| 5   | Explains recommendations, answers queries        | `/api/explain`, `/api/ask`                   |
| 6   | Progress dashboard                               | `/dashboard/[id]`                            |

## Evaluation (current, against the curated corpus with embeddings)

Full report: [`eval-results/eval.md`](../eval-results/eval.md). Corpus: 65 skills, 126 resources,
scored against 9 hand-labelled expert paths.

| Metric                             | Waypoint  | Similarity baseline |
| ---------------------------------- | --------- | ------------------- |
| Prerequisite violation rate        | **0.0%**  | 49.0%               |
| Gap coverage                       | **93.0%** | 64.7%               |
| Redundancy                         | **16.8%** | 36.3%               |
| nDCG vs. expert path               | **0.392** | 0.168               |
| Ordering correlation (Kendall tau) | **0.459** | 0.111               |
| Hours prescribed                   | 71.3h     | 231.6h              |

Baseline similarity uses Cohere `embed-v4.0` — the same embeddings our retriever uses — so the
comparison is honest rather than a strawman. These numbers are quotable.

Reproduce with `npm run eval -- --corpus data/live --json`. **Without `--corpus data/live` the
harness scores the small bootstrap corpus instead** and prints quite different numbers.

**SCN-05 is deliberately unscored.** Its goal ("I want to work with AI") is too vague to compile
into a destination, so intake asks a clarifying question instead of inventing one. A system that
guessed would score here and be wrong in a way nobody could check.

## Corpus depth pass (Mon 31 Aug)

The audit previously reported 28 skills that topped out below level 4 and 10 taught by a single
resource. 31 advanced resources were added (every URL checked live before it went in), taking the
corpus from 95 to 126.

| Audit check                   | Before   | After   |
| ----------------------------- | -------- | ------- |
| Skills capped below level 4   | 28 of 65 | **0**   |
| Skills with a single resource | 10       | **0**   |
| Mean resources per skill      | 2.8      | **3.5** |

Effect on the evaluation, measured rather than assumed — both runs in embeddings mode against
`data/live`:

| Metric               | 95 resources | 126 resources   |
| -------------------- | ------------ | --------------- |
| Gap coverage         | 91.5%        | **93.0%**       |
| nDCG vs. expert      | 0.382        | **0.392**       |
| Ordering correlation | 0.452        | **0.459**       |
| Redundancy           | 14.5%        | 16.8% _(worse)_ |

Honest reading: the ceilings were **not** the main cause of the coverage shortfall. Closing all 28
moved coverage 1.5 points, not the ~8 the earlier hypothesis implied. Coverage is now 100% on seven
of nine scenarios; the two that fall short (SCN-02 at 72%, SCN-03 at 65%) are limited by the
learner's stated hours, not by what the corpus can teach. Redundancy rose slightly because a larger
corpus offers more overlapping options.

## Known limitations (stated rather than hidden)

1. Two scenarios close only part of the gap because the learner's available hours cannot cover the
   whole goal. The planner prescribes the realistic first phase rather than a plan nobody can follow.
2. The planner caps a path at 12 steps, so the very deepest goals in the graph return a partial
   route with `complete: false` rather than pretending to finish.

## Defects the tooling caught (none reached the browser)

1. Cohere v1 API lacks `outputDimension` → moved to v2 namespace.
2. Bootstrap rows taught a skill no higher than they required → exposed that the rule wrongly banned
   legitimate _deepening_ resources; fixed rule and data.
3. Amber-on-white contrast 2.13:1 → dark-aware amber, a11y 95 → 100.
4. `__dirname` in an ESM vitest config would silently break the `@/` alias → `import.meta.dirname`,
   plus a guard test.
5. **Quality discount made goals unreachable** — a course teaching a skill to level 4 only moved the
   learner to 3.76, so no path could ever complete. Quality now affects _selection_, not gain.
6. **Beam search discarded terminal states** — the planner recommended 18h where 12h reached the
   goal. Settled-state pool added; regression test locks it.
7. **Feedback changed nothing** — the learner was never credited with steps walked past, and a
   struggled course could be prescribed again. Both fixed; struggling now visibly reroutes.
8. **The diff lied to the learner** — a completed step was reported as "dropped". Diff now separates
   completed / swapped out / dropped.
9. **The hallucination guard over-fired** — every explanation was silently falling back to the
   template. Widened, with regression tests.
10. **A `\b` became a backspace character** — a scripted edit turned a word-boundary regex into a
    no-op. Rebuilt with `String.raw`.
11. **`drizzle-kit push` silently did nothing** without a terminal — replaced with an idempotent
    `npm run db:migrate` that verifies the columns afterwards and fails loudly if they are missing.
12. **`aria-hidden` wrapped focusable buttons** in a duplicated screen-reader list — removed both the
    duplicate and the attribute (a11y 96 → 100).
13. **The re-plot animation applied its offset after paint**, so stops visibly jumped and then
    animated. Moved to a layout effect.
14. **`animation-fill-mode: both` outranked inline styles**, silently cancelling the survivor slide.
15. **Reduced motion still flashed** — the shared-layout invert ran for one frame with transitions
    disabled. Now skipped entirely under the preference.

## Remaining before submission (Mon 31 Aug)

| #   | Item                                              | Owner   |
| --- | ------------------------------------------------- | ------- |
| 1   | Solution documentation PDF/PPT (brief B3)         | Prateek |
| 2   | Demo video 3–5 min (brief B4)                     | Ayush   |
| 3   | Run-through recording for the video team          | Devansh |
| 4   | Build + verify submission ZIP on a clean checkout | Devansh |
| 5   | Fill and save the submission form by 18:00        | Prateek |

## Track B inputs

| Input                | Owner           | Status                                        |
| -------------------- | --------------- | --------------------------------------------- |
| Skills tab           | Prateek + Ayush | delivered — 65 skills                         |
| Resources            | Prateek + Ayush | delivered — 95 resources (B1 target was 150+) |
| Eval scenarios       | Ayush           | delivered — 10 scenarios                      |
| Solution doc         | Prateek         | **outstanding**                               |
| Demo video           | Ayush + both    | **outstanding**                               |
| Submission logistics | Prateek         | **outstanding**                               |
