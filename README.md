# Waypoint — AI-Powered Personalized Learning Path Recommender

HCL Round 2 submission. Waypoint treats learning-path recommendation as **planning over a skill
graph**, not text similarity: a learner is a mastery vector, a goal compiles to a target skill state,
and the recommended path is a prerequisite-feasible sequence that closes the gap in the fewest hours.
Every step is explained from the plan that produced it, so recommendations cannot be hallucinated.

## Try it

**Live: https://waypoint-six-teal.vercel.app** — fully configured, nothing to install.
That is the fastest way to see all six features, including conversational intake.

Running from this ZIP instead? `npm install && npm run dev`, then open `/plan`. Five of
the six features work with **no database, no API keys and no configuration at all** —
routes plan, every step explains itself, and `/eval` shows the evaluation. Only `/start`
needs a language-model key, and it will tell you so and point you to `/plan`.


| Page                     | What it is                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `/start`                 | Describe your goal in your own words; the profile fills in as you talk, then plot a route |
| `/plan`                  | Pick a destination directly — no language model needed, useful as a fallback              |
| `/dashboard/[learnerId]` | Progress, skill levels, milestones and the next thing to do                               |
| `/eval`                  | How this planner scores against a similarity baseline on expert-written paths             |

## What it does

1. **Conversational intake** — describe a goal in natural language; the profile fills in as you talk.
2. **Learner profiling** — interests, experience level, completed courses and objectives become a
   mastery vector over a canonical skill graph.
3. **Recommendation engine** — hybrid retrieval (skill-tag overlap + dense embeddings + lexical
   signal, optional cross-encoder rerank) scored against the learner's _gap_, not their query text.
4. **Path generation** — beam search where the prerequisite DAG constrains candidate generation, so
   an infeasible ordering can never be produced. Milestones are emitted as goal sub-skills complete.
5. **Explanations** — each step carries a machine-built reasons object; the LLM only phrases it.
6. **Dashboard + adaptation** — progress, skill mastery, milestones, next actions; feedback updates
   mastery and replans the route with a visible diff.

## Requirements

- Node.js 20+ (developed on 24) and npm — this alone runs the planner, the
  explanations and the evaluation page
- An OpenAI-compatible LLM gateway key — **required for conversational intake
  at `/start`**; every other screen works without it
- Optional: a Cohere key (dense embeddings and reranking)
- Optional: Postgres with `pgvector` (persistence; Supabase works out of the box)

## Setup

**No database or API key is required to see the planner work.** With nothing configured, Waypoint
loads its corpus from the CSVs in `data/` and keeps learner state in memory. `/start` is the one
screen that needs a language-model key — it will tell you so and point you at `/plan`:

```bash
npm install
npm run dev                    # http://localhost:3000/plan
```

Open `/plan`, choose a destination, and the planner will build a route. `/eval` shows how it scores
against expert-labelled paths.

For the full experience (conversational intake, embeddings, persistence):

```bash
cp .env.example .env.local     # fill in the values (see below)
npm run db:push                # create the Postgres schema (interactive; confirm when asked)
npm run db:migrate             # apply column additions made since that first push
npm run import                 # load the corpus into Postgres, with embeddings
```

With `DATABASE_URL` set the app switches to Postgres automatically and learner progress survives
restarts. Without it, everything still works and state lives in memory for the life of the process.
`npm run db:migrate` is idempotent — run it any time; it is how schema changes reach a database that
already exists, because `drizzle-kit push` needs a terminal to confirm and does nothing without one.

### Environment variables

Nothing here is needed to **start** the app: with an empty environment it reads
the corpus from CSV, keeps state in memory, and `/plan` will plan real routes.
What each variable buys is a feature, so the table says what you lose without
it rather than a bare yes/no.

| Variable             | Without it                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `RIKKO_API_KEY`      | **`/start` cannot read a goal.** Conversational intake needs a language model; the page says so and sends you to `/plan`, which needs no key. |
| `LLM_BASE_URL`       | Defaults to `https://myrikko.ai/v1`. Only set it for a different OpenAI-compatible gateway.                                                 |
| `DATABASE_URL`       | Learner state lives in memory and is lost when the process stops. Planning, explanations and `/eval` are unaffected.                        |
| `COHERE_API_KEY`     | Retrieval loses its dense signal and renormalises onto skill tags and lexical overlap; the rerank stage is skipped. Routes still plan.      |
| `LLM_MODEL_PRIMARY`  | Defaults to `deepseek-v4-pro-0813` (chat, extraction, explanations).                                                                        |
| `LLM_MODEL_FAST`     | Defaults to `glm-5.3-flash` (cheap bulk calls).                                                                                            |
| `LLM_MODEL_SHOWCASE` | Defaults to `claude-opus-5`. Optional higher-tier model.                                                                                    |
| `RERANK`             | Defaults to `on`. Set `off` to skip the cross-encoder rerank.                                                                               |

For Supabase, `DATABASE_URL` must be the **transaction pooler** connection string.

**The shortest path to seeing it work is `/plan` with no configuration at all.**
To exercise all six features — conversational intake included — set
`RIKKO_API_KEY`, and add `COHERE_API_KEY` before quoting any evaluation numbers.

## Importing a corpus

The corpus is authored in a spreadsheet (schema in [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md)
§3.3) and exported as CSV:

```bash
npm run import -- path/to/skills.csv path/to/resources.csv path/to/scenarios.csv
npm run import -- path/to/skills.csv path/to/resources.csv --validate-only   # check without writing
```

The importer validates everything before writing anything — unknown skill slugs, out-of-range
levels, duplicate ids or URLs, prerequisite cycles, and expert paths referencing missing resources —
and reports each problem with the spreadsheet row number. A failed import writes nothing.

## Scripts

| Command                         | What it does                                                                |
| ------------------------------- | --------------------------------------------------------------------------- |
| `npm run dev`                   | Development server                                                          |
| `npm run build` / `npm start`   | Production build and serve                                                  |
| `npm test`                      | Unit tests (Vitest)                                                         |
| `npm run db:push`               | Create the Drizzle schema on a fresh database (asks for confirmation)       |
| `npm run db:migrate`            | Apply schema top-ups to an existing database (idempotent)                   |
| `npm run db:studio`             | Browse the database                                                         |
| `npm run import`                | Import a corpus (see above)                                                 |
| `npm run eval -- --corpus data/live` | Score the planner against hand-labelled scenarios vs. a similarity baseline |
| `npm run audit`                 | Corpus health: teachability, reachable prerequisites, level ceilings, shape |
| `npm run plan -- "skill:level"` | Generate a path from the CLI against the bootstrap corpus (no database)     |
| `npm run package`               | Build the submission ZIP from tracked files only                            |

## Evaluation

The planner is scored against learning paths a human expert wrote by hand, alongside a similarity
baseline (rank resources by similarity to the goal text, present them in similarity order — the
standard approach). Both see the same corpus and the same similarity signal.

```bash
npm run eval -- --corpus data/live --json   # writes eval-results/eval.md and eval.json
```

**Pass `--corpus data/live`.** Without it the harness scores the small `data/bootstrap` seed corpus,
which is a different and much easier comparison than the published numbers.

Metrics: prerequisite violation rate (steps the learner was not ready for), gap coverage,
redundancy, nDCG and Kendall tau against the expert ordering. Results render at `/eval`.

Set `COHERE_API_KEY` before quoting the numbers: without it the baseline falls back to word-overlap
similarity, which understates it, and the generated report says so.

## Learner identity

There is no sign-up. Completing an intake mints an unguessable learner id (a v4
UUID, 122 bits of entropy) and the dashboard URL that contains it is the way
back to that route — the same "anyone with the link" model a shared document
uses. The browser keeps a local list of the routes it has plotted so they stay
reachable after a tab closes; that list is a convenience pointer only, and
clearing it deletes nothing — every route, its history and its events remain in
the database and remain reachable by URL.

This is a deliberate trade for a prototype that has to be evaluated by someone
who has never seen it before: a login wall would put a signup between a reviewer
and a working product, and the data held is a first name and a set of learning
goals. Real authentication would slot in through Supabase Auth against the same
`learners` table, which is already keyed by UUID rather than by session.

## Architecture

- **App**: Next.js 16 (App Router) + TypeScript, React 19, Tailwind, shadcn/ui
- **Data**: Postgres + pgvector via Drizzle ORM, behind a store interface with an in-memory
  implementation so the app runs with no database at all
- **AI/ML**: hybrid retrieval over a skill-tagged corpus, DAG-constrained beam-search planning,
  rule-based mastery updates, LLM used only for extraction and phrasing
- **Deploy**: Vercel (app) + Supabase (database)

Full design: [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md). Problem brief and rubric:
[docs/00-BRIEF.md](docs/00-BRIEF.md).

## Project layout

```
src/app/          routes and UI
src/components/   UI, including the shared transit-route view
src/lib/          gap model, retrieval, planner, LLM and corpus parsing
src/db/           Drizzle schema and client
scripts/          import.ts, eval.ts, audit-corpus.ts and other CLI tools
data/live/        the curated corpus (CSV) — used when present
data/bootstrap/   seed corpus (CSV) — the fallback when data/live is empty
eval-results/     committed eval output, rendered by /eval
docs/             brief, architecture, plan, verification, teammate briefs
```

The corpus loader prefers `data/live` and falls back to `data/bootstrap`, so a
clean checkout runs against the curated corpus with no database and no keys.
