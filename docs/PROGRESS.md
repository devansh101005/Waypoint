# PROGRESS

Updated at every phase gate. Times IST.

## Status: Phase 0 complete — awaiting accounts to finish Gate 0

**Last update:** Fri 28 Aug, ~20:15
**Hours used (Track A):** ~1.5 of ~30–33 budgeted
**Pace vs. plan:** ahead (Phase 0 budgeted 4 h, core work done in ~1.5 h)
**Cut ladder:** nothing fired

## Done and verified

| Item                                         | Evidence                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| Planning docs 00–04                          | `docs/` — brief, differentiation, architecture, plan, verification      |
| Verification hooks (4)                       | Tested with block + allow payloads; caught 2 real defects already       |
| verify-feature skill + skeptic agent         | `.claude/skills/`, `.claude/agents/`                                    |
| Next.js 16 + TS + Tailwind + shadcn scaffold | `npm run build` passes                                                  |
| DB schema (11 tables, pgvector)              | `src/db/schema.ts`, typechecks                                          |
| LLM adapter (Rikko, OpenAI-compatible)       | `src/lib/llm.ts` — JSON extraction with Zod validation + retry          |
| Embeddings adapter (Cohere v2, optional)     | `src/lib/embeddings.ts` — degrades cleanly without a key                |
| Corpus parser + validator                    | `src/lib/corpus.ts` — 20 unit tests pass                                |
| Import script                                | `npm run import -- ... --validate-only` passes on bootstrap corpus      |
| Bootstrap corpus                             | 40 skills, 41 resources, 2 domains — validated                          |
| Landing stub                                 | Lighthouse: a11y **100**, best-practices 100, SEO 100; 0 console errors |
| Track B briefs B1, B2                        | `docs/briefs/` — ready to send                                          |

Defects the tooling caught (not me): (1) Cohere v1 API lacks `outputDimension` → moved to v2;
(2) my own bootstrap data had 3 rows teaching a skill no higher than it required → fixed the rule to
allow deepening resources, fixed the data; (3) amber-on-white contrast 2.13:1 → dark-aware amber,
a11y 95 → 100.

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

Hybrid retrieval substrate: tsvector + pgvector queries, the gap-aware scorer with unit tests, debug
search endpoint. Gate 1 needs a real corpus import from the teammates' sheet.
