# 03 — PLAN (28 Aug ~20:00 IST → 31 Aug 23:59 IST)

## Ground truth

- **One coder (Devansh).** Track A is strictly serial; nothing in it assumes a second pair of hands.
- Realistic solo coding capacity before freeze: **~30–33 h** (Fri ~4 h, Sat ~14 h, Sun ~12 h). The must-have set costs ~21–27 h. Margin is thin and the cut ladder is armed from the start.
- **Code freeze: Sun 30 Aug 21:00 IST.** After freeze: P0 fixes only (crash, demo-blocking, data loss). 31 Aug is for deliverables, not development.
- All times IST. "Gate" = verification gate (04-VERIFICATION.md): typecheck + tests + verify-feature on the browser path + commit.

## Track A — Devansh, all code, serial

### Phase 0 — Skeleton + first deploy (Fri 28, 21:00–01:00, 4 h)
Scaffold Next.js 15 + TS + Tailwind + shadcn init + Drizzle; Supabase project + schema push; **deploy stub to Vercel tonight** (retire first-deploy risk on a hello-world, never at the end); env plumbing local+Vercel; Vitest wired; bootstrap skill graph (~30 skills, one domain) + ~20 hand-tagged resources committed as CSV; import script v0 (validate + upsert, embeddings can wait for Phase 1).
**Gate 0:** prod URL renders; `npm run db:push` + `npm run import` succeed; hooks/tests green. Commit history starts tonight.

### Phase 1 — Data + retrieval substrate (Sat 29, 09:00–14:00, 5 h)
Import script v1 (full validation incl. cycle check, Cohere batch embeddings, idempotent upsert); tsvector + pgvector queries; hybrid scorer with unit tests on bootstrap data; debug search endpoint + minimal admin page. **13:00: corpus v1 lands from Track B → run real import.**
**Gate 1:** import of teammates' sheet passes or produces a row-numbered error report back to them; hybrid search returns sane results for 5 spot queries.

### Phase 2 — Gap model + path planner (Sat 29, 14:00–19:00, 5 h) — the heart
Mastery vector assembly; goal→gap compiler with DAG closure; feasible-frontier beam search; milestones; reasons objects; unit tests: zero prereq violations on adversarial fixtures (learner knows nothing / knows half / knows more than goal).
**Gate 2:** CLI generates paths for 3 bootstrap personas — feasible orderings, sensible hours, reasons populated.

### Phase 3 — Intake chat + profile + explanations (Sat 29, 20:00–01:00, 5 h)
Streaming chat route + enum-constrained structured extraction; profile panel UI filling live; generate-path action; path timeline UI (route-line design, minimal styling pass); explanation rendering (LLM phrasing + template fallback); learner Q&A grounding.
**Gate 3:** full user journey in the browser via verify-feature: describe goal → profile fills → path renders with explanations. This is the end-to-end milestone; everything after is additive.

### Phase 4 — Feedback loop + dashboard (Sun 30, 09:00–13:00, 4 h)
Feedback events → mastery update → replan → **diff view**; dashboard (progress, per-skill mastery bars, milestones, next actions) from shadcn dashboard block + Recharts; skill-map React Flow view **only if on schedule** (stretch S1 decision point at 11:30).
**Gate 4:** verify-feature runs the adaptation story: mark "struggled" → path changes with visible diff.

### Phase 5 — Eval harness (Sun 30, 13:00–16:00, 3 h)
`scripts/eval.ts`: baseline (honest cosine top-k) vs. ours (± rerank); metrics per 02-ARCHITECTURE 4.5; markdown + JSON output committed; `/eval` page rendering the table; **one weight-sweep run**, pick weights, record numbers for the doc. Needs Scenarios tab (due Sat 20:00).
**Gate 5:** eval table exists with real numbers; ours ≥ baseline on violations + coverage. If we don't beat baseline on expert agreement, say so honestly in the doc and lead with the violation/coverage win — do not fudge.

### Phase 6 — Polish + demo data (Sun 30, 16:00–19:00, 3 h)
frontend-design-guided pass within budget: type/color/spacing per committed direction, route-line element, empty/loading/error states, Lighthouse ≥90 accessibility via verify-feature; seed 2 polished demo learners; landing page (one screen, thesis sentence).
**Hard rule: this phase shrinks to fit — it never borrows time from Phases 1–5.**

### Phase 7 — Freeze prep (Sun 30, 19:00–21:00, 2 h)
Final deploy + prod smoke test (all six features on the deployed URL); README complete (setup, env, import, eval, architecture pointer); `npm run package` ZIP dry run; tag `v1.0`. **CODE FREEZE 21:00.**
21:00–24:00 buffer: P0 fixes from Track B QA only. Each fix: branch → verify → deploy → re-smoke.

### Mon 31 Aug — deliverables day (no development)
- 09:00–09:45 recorded app run-through for the video team (their raw footage) + Loom backup.
- 10:00–11:00 review solution doc draft for technical accuracy (only technical review — not rewriting).
- 11:00–14:00 P0-only support for QA findings; else help script the video's eval segment.
- 14:00–15:00 final ZIP build + exclusion check (unzip into temp dir and run it once, per README, on a machine-clean checkout).
- **15:00–18:00 submit everything.** Form fully filled and saved by 18:00 — the platform allows edits until 23:59, so late improvements can still be swapped in, but a complete submission exists from 18:00 onward. Nothing waits for 23:00.

## Track B — teammates, zero code, fully parallel

Every task gets a standalone brief in `docs/briefs/` (written tonight, first thing after plan approval). Current roster: Prateek, Ayush. If slots 4–5 fill, they join B1/B2 first (earliest deadlines), then B4/B5.

| ID | Task | Owner (3-person) | Deliverable | Due |
|---|---|---|---|---|
| B1a | **Skills tab** (~40–60 skills, 2 domains, prereqs) | Prateek + Ayush jointly | Sheet tab per schema | **Sat 11:00** |
| B1b | **Resources v1** (60+ items, tagged) | Prateek + Ayush | Sheet tab | **Sat 13:00** |
| B1c | **Resources v2** (150+ total, both domains) | Prateek + Ayush | Sheet tab | **Sat 20:00** |
| B2 | **Eval scenarios** (8–12, with expert paths) | Ayush | Scenarios tab | **Sat 20:00** |
| B3 | **Solution doc** (PDF/PPT) draft from 00/01/02 docs | Prateek | Draft Sun 20:00 → final PDF **Mon 15:00** | |
| B4 | **Demo video** script Sun; edit from Mon run-through | Ayush (script) + both (edit) | 3–5 min video, uploaded, URL | **Mon 17:00** |
| B5 | **Manual QA** on frozen build (devices/browsers, plain-language bug reports, P0/P1/P2 labels) | Both | Bug list in sheet | Sun 21:00–23:00 + Mon 09:00–12:00 |
| B6 | **Submission logistics** (deliverables checklist, form fields, ZIP verified on their machine) | Prateek | Checklist + confirmed submission | Mon 18:00 |
| B7 | Competitive/domain research → 2 pages into doc's differentiation section | whoever has slack | notes | Sun 12:00 |

**B1/B2 are the earliest deadlines in the entire plan because Track A blocks on them.** Brief them tonight; check in Sat 10:00.

## Handoff points and late-arrival fallbacks

| Handoff | Flows into | If late/thin |
|---|---|---|
| Skills tab (Sat 11:00) | Phase 1 import | Build on bootstrap skill graph; teammates' skills merge in v2. Cost: corpus tagging quality, not features. |
| Resources v1 (Sat 13:00) | Phase 1/2 real-data testing | Continue on 20-item bootstrap; demo thinness risk, features unaffected. |
| Resources v2 (Sat 20:00) | Sun morning re-import | Ship v1 corpus (60). Below ~40 usable rows: Kaggle bulk import for search breadth + bootstrap for path planning, and demo scripts around the strong domain. |
| Scenarios (Sat 20:00) | Phase 5 eval | **I write 4 scenarios myself in 1 h Sun 13:00** (comes out of Phase 6 budget). Eval ships regardless — smaller n, stated in the doc. |
| Doc draft (Sun 20:00) | My Mon review | I review whatever exists Mon morning; worst case I dictate architecture sections for 1 h Mon (out of buffer). |
| Video footage (Mon 09:00 session) | B4 edit | Fallback: single-take screen recording with live voiceover, done by me Mon 19:00–20:00. Rough but submitted. |
| QA reports (Sun 23:00) | Freeze-buffer fixes | No reports → I run the six-feature smoke myself on two browsers. |

## Cut ladder (ordered; trigger fires → cut executes, no debate)

| # | Trigger (wall clock) | Cut | Saves |
|---|---|---|---|
| 1 | Sat 19:00, Phase 2 gate not passed | Cohere rerank stage (flag stays off; eval reports hybrid only) | ~1.5 h |
| 2 | Sat 23:00, chat not streaming end-to-end | Multi-turn intake → single-shot guided form + one extraction call, chat-styled UI (feature 1 still checks) | ~2 h |
| 3 | Sun 11:30 (standing decision point) | Skill-map React Flow view (S1) → path renders as timeline only | ~3 h |
| 4 | Sun 13:00, Phase 4 gate not passed | Quiz (S2, if alive) + mastery propagation → simple update rules only | ~2–3 h |
| 5 | Sun 15:00, eval not producing numbers | `/eval` page → CLI markdown table, screenshotted into doc + README | ~1 h |
| 6 | Sun 17:00 | Phase 6 polish beyond Lighthouse-a11y fixes + demo seed data | ~2 h |
| 7 | Sun 19:00, any six-feature box still unchecked | Everything else stops; remaining hours go to the floor build below | — |

Trigger #1 firing early is expected and healthy, not a failure signal. The rule: **UI polish dies before ML; stretch dies before must-have; nothing on the floor list ever dies.**

## The floor (minimum submission — all six boxes checked, never go below)

1. Chat-styled intake with one structured extraction call → profile stored (features 1+2).
2. Hybrid retrieval (even tag-overlap + cosine only) → ranked resources (feature 3).
3. DAG-feasible greedy path (beam width 1) with milestone labels (feature 4).
4. Template-rendered reasons per item + grounded Q&A answering from the reasons object (feature 5).
5. Dashboard: mastery bars + path progress + next action (feature 6).
6. Feedback button that visibly replans (Task-sentence requirement).
Plus: deployed URL, README, ZIP, doc, video — the five deliverables.

## Underestimated-by-solo-devs reserve (already inside the schedule)

- Environment setup + first deploy: Phase 0 is fully dedicated — not squeezed into feature time.
- Corpus import against *real* teammate data: 1 h of Phase 1 assumes their sheet has errors (it will; the error report is the fix loop).
- Last-mile ZIP/README/form: 2+ h on Mon with a dry run on Sun (Phase 7).
- Prod-vs-local drift: every phase gate from Phase 3 onward runs its browser check against the **deployed** URL at least once per day (Sat night, Sun night).

## Commit protocol (captain's rule)

**Claude never runs `git commit` or `git push`.** At every commit point (small and often — history is graded), Claude hands Devansh a ready-to-paste command block (`git add <files>` + `git commit -m "<conventional message>"`); Devansh reviews and runs it. Push cadence: at minimum at every phase gate (each push = Vercel deploy).

## Account setup checklist (Devansh, tonight, ~25 min — do in this order)

1. **GitHub**: create empty repo `waypoint` (no README/gitignore — the local repo already has content). Copy the remote URL.
2. **Rikko**: from the console, copy (a) an API key and (b) the exact OpenAI-compatible base URL shown in their quickstart/curl example (likely `https://myrikko.ai/v1` or `https://api.myrikko.ai/v1` — confirm from the console, don't guess). Paste both into `.env.local` when the scaffold lands.
3. **Cohere** (dashboard.cohere.com): sign up free, create a trial key → `.env.local`. If signup is painful, skip — the scorer runs without dense/rerank until it exists.
4. **Supabase**: new project (region: Mumbai/Singapore), copy the pooled connection string (Transaction mode) → `DATABASE_URL`.
5. **Vercel**: import the GitHub repo `waypoint` after the first push tonight; paste all env vars from `.env.local` into project settings.

## Progress discipline

`docs/PROGRESS.md` updated at every gate: done / verified / blocked / hours vs. plan / outstanding Track B inputs. If actual pace falls ≥2 h behind plan, I say so at the next gate and name the cut-ladder item to fire — no silent quality compression.
