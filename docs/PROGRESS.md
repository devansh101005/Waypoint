# PROGRESS

Updated at every phase gate. Times IST.

## Status: Phases 0, 2, 3 (core), 4 and 5 complete — well ahead of plan

**Last update:** Sat 29 Aug, ~13:05
**Hours used (Track A):** ~6 of ~30-33 budgeted
**Pace vs. plan:** well ahead - Phase 2 (AI/ML core) and Phase 5 (evaluation harness) both
landed Friday night instead of Saturday/Sunday, because neither needs a database.
**Cut ladder:** nothing fired

## Done and verified

| Item | Evidence |
|---|---|
| Planning docs 00-04 | `docs/` |
| Verification hooks (4) | Tested block + allow; have caught 6 real defects so far |
| verify-feature skill + skeptic agent | `.claude/skills/`, `.claude/agents/` |
| Next.js 16 + TS + Tailwind + shadcn scaffold | `npm run build` passes |
| DB schema (11 tables, pgvector) | `src/db/schema.ts` |
| LLM adapter (Rikko, OpenAI-compatible) | `src/lib/llm.ts` - Zod-validated extraction + retry |
| Embeddings adapter (Cohere v2, optional) | `src/lib/embeddings.ts` - degrades without a key |
| Corpus parser + validator | `src/lib/corpus.ts` - 21 tests |
| Import script | validates bootstrap corpus clean |
| Bootstrap corpus | 40 skills, 41 resources, 2 domains |
| **Skill graph (DAG)** | `src/lib/graph.ts` - ancestors, depth, topo order, cycle detection |
| **Mastery model** | `src/lib/mastery.ts` - completion, struggle, quiz, downward propagation |
| **Gap compiler** | `src/lib/gap.ts` - goal-state delta over the DAG, frontier, gap card |
| **Hybrid scorer** | `src/lib/scoring.ts` - tag/dense/lexical with weight renormalisation |
| **DAG-constrained planner** | `src/lib/planner.ts` - beam search, milestones, reasons objects |
| Planner verified on real corpus | `npm run plan -- "dashboarding:4"` - 7 steps, 86h, **0 violations** |
| **Evaluation metrics** | `src/lib/eval.ts` - violations, coverage, redundancy, nDCG, Kendall tau |
| **Similarity baseline** | `src/lib/baseline.ts` - the "LLM wrapper" approach, implemented fairly |
| **Eval harness** | `npm run eval` - 5 seed scenarios, markdown + JSON output |
| **/eval page** | Lighthouse a11y **100**, best-practices 100, 0 console errors |
| Seed eval scenarios (fallback) | `data/bootstrap/scenarios.csv` - 5 personas, pulled forward from the Sun 13:00 fallback |
| Landing stub | Lighthouse a11y **100**, best-practices 100, 0 console errors |
| Track B briefs B1, B2 | `docs/briefs/` - dates corrected to Sat 29 Aug |

| **Explanation layer** | `src/lib/explain.ts` - LLM phrasing + hallucination guard + template fallback |
| **Intake extraction** | `src/lib/intake.ts` - enum-constrained to the skill graph, invented slugs dropped |
| **Store abstraction** | `src/lib/store.ts` - in-memory from CSV; the app runs with no database at all |
| **Service layer** | `src/lib/service.ts` - generate, feedback, replan, diff |
| **API routes** | `/api/intake`, `/api/paths`, `/api/paths/feedback`, `/api/demo` |
| **Route view (signature UI)** | `src/components/path-route.tsx` - amber route line, waypoints, milestone diamonds |
| **/plan page** | Full journey verified in-browser; Lighthouse a11y **100**, 0 console errors |

**Test suite: 149 passing** (corpus 21, graph/gap/mastery 22, planner/scoring 31, eval/baseline 23,
explain/intake 28, service 23, alias guard 1).

Defects the tooling and fixture runs caught (none reached the browser):
1. Cohere v1 API lacks `outputDimension` -> moved to v2 namespace.
2. Bootstrap rows taught a skill no higher than they required -> exposed that the rule wrongly
   banned legitimate *deepening* resources; fixed rule and data.
3. Amber-on-white contrast 2.13:1 -> dark-aware amber, a11y 95 -> 100.
4. `__dirname` in an ESM vitest config would silently break the `@/` alias -> `import.meta.dirname`,
   plus a guard test.
5. **Quality discount made goals unreachable** - a course teaching a skill to level 4 only moved the
   learner to 3.76, so no path could ever complete. Quality now affects *selection*, not gain.
6. **Beam search discarded terminal states** - a branch that finished in one step lost to a longer
   branch still growing, so the planner recommended 18h where 12h reached the goal. Settled-state
   pool added; regression test locks it.
7. **Feedback changed nothing** - the first replan returned an identical path ("Your path is
   unchanged"), killing the demo's key beat. Two causes: the learner was never credited with the
   steps they had walked past, and a course they struggled with could be prescribed again. Both
   fixed; struggling now visibly reroutes.
8. **The diff lied to the learner** - a step they had just completed was reported as "dropped",
   which reads as the plan discarding their work. Diff now separates completed / swapped out /
   dropped, each with its own wording.

## Blocked on Devansh (tonight, ~25 min)

1. GitHub repo `waypoint` created + first push
2. Rikko API key + **exact** base URL from the console → `.env.local`
3. Supabase project + `DATABASE_URL` → then `npm run db:push` && `npm run import`
4. Vercel import of the repo + env vars → first deploy (Gate 0 closes here)
5. Cohere trial key (optional, do last)

## Outstanding Track B inputs

| Input                 | Owner           | Due       | Status                  |
| --------------------- | --------------- | --------- | ----------------------- |
| Skills tab            | Prateek + Ayush | Sat 11:00 | brief written, not sent |
| Resources v1 (60+)    | Prateek + Ayush | Sat 13:00 | brief written, not sent |
| Resources v2 (150+)   | Prateek + Ayush | Sat 20:00 | —                       |
| Eval scenarios (8–12) | Ayush           | Sat 20:00 | brief written, not sent |
| Solution doc draft    | Prateek         | Sun 20:00 | brief not yet written   |
| Demo video            | Ayush + both    | Mon 17:00 | brief not yet written   |

## Next up

Conversational intake UI on top of `/api/intake` (needs the Rikko key to test live), then the
dashboard view. Postgres store implementation when `DATABASE_URL` lands - the interface is already
in place, so it is an additive change rather than a rewrite.

## First eval numbers (provisional, lexical baseline)

| Metric | Waypoint | Baseline |
|---|---|---|
| Prerequisite violations | **0.0%** | 59.4% |
| Gap coverage | **100.0%** | 51.9% |
| nDCG vs. expert | **0.822** | 0.314 |
| Ordering correlation | **0.635** | 0.293 |

Caveat recorded in the report itself: without an embedding key the baseline ranks by word overlap,
which understates it. The prerequisite result is structural and will survive; the relevance figures
will narrow once `COHERE_API_KEY` is set. **Do not quote these to judges until re-run with embeddings.**
