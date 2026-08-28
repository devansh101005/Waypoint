# PROGRESS

Updated at every phase gate. Times IST.

## Status: Phase 0 complete, Phase 2 (planner) built ahead of schedule

**Last update:** Fri 28 Aug, ~20:40
**Hours used (Track A):** ~2.5 of ~30-33 budgeted
**Pace vs. plan:** ahead - Phase 2 (the AI/ML core) landed Friday night instead of Saturday
afternoon, because it needs no database and Supabase is not up yet.
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
| Landing stub | Lighthouse a11y **100**, best-practices 100, 0 console errors |
| Track B briefs B1, B2 | `docs/briefs/` - dates corrected to Sat 29 Aug |

**Test suite: 73 passing** (corpus 21, graph/gap/mastery 22, planner/scoring 29, alias guard 1).

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

## Next up (Phase 1, Sat 09:00–14:00)

Wire the planner to Postgres: pgvector + tsvector queries feeding the scorer, corpus import against
the teammates’ real sheet, and the debug search endpoint. Needs `DATABASE_URL`.
