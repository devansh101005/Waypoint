# Waypoint — AI-Powered Personalized Learning Path Recommender

HCL Round 2 submission. Waypoint treats learning-path recommendation as **planning over a skill
graph**, not text similarity: a learner is a mastery vector, a goal compiles to a target skill state,
and the recommended path is a prerequisite-feasible sequence that closes the gap in the fewest hours.
Every step is explained from the plan that produced it, so recommendations cannot be hallucinated.

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

- Node.js 20+ (developed on 24) and npm
- A Postgres database with the `pgvector` extension (Supabase works out of the box)
- An API key for an OpenAI-compatible LLM gateway
- Optional: a Cohere key for embeddings and reranking (the app runs without it)

## Setup

```bash
npm install
cp .env.example .env.local     # then fill in the values (see below)
npm run db:push                # create the schema
npm run import                 # load the bootstrap corpus (40 skills, 41 resources)
npm run dev                    # http://localhost:3000
```

### Environment variables

| Variable             | Required | Purpose                                                                   |
| -------------------- | -------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`       | yes      | Postgres connection string (Supabase: use the **transaction pooler** URL) |
| `RIKKO_API_KEY`      | yes      | API key for the OpenAI-compatible LLM gateway                             |
| `LLM_BASE_URL`       | no       | Gateway base URL (default `https://myrikko.ai/v1`)                        |
| `LLM_MODEL_PRIMARY`  | no       | Chat, extraction and explanations (default `deepseek-v4-pro-0813`)        |
| `LLM_MODEL_FAST`     | no       | Cheap bulk calls (default `glm-5.3-flash`)                                |
| `LLM_MODEL_SHOWCASE` | no       | Optional higher-tier model (default `claude-opus-5`)                      |
| `COHERE_API_KEY`     | no       | Embeddings (`embed-v4.0`) and rerank (`rerank-v3.5`)                      |
| `RERANK`             | no       | `on` (default) or `off` to disable the rerank stage                       |

Without `COHERE_API_KEY` the app still runs: retrieval falls back to skill-tag and lexical signals
and the rerank stage is skipped.

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

| Command                       | What it does                                                                |
| ----------------------------- | --------------------------------------------------------------------------- |
| `npm run dev`                 | Development server                                                          |
| `npm run build` / `npm start` | Production build and serve                                                  |
| `npm test`                    | Unit tests (Vitest)                                                         |
| `npm run db:push`             | Apply the Drizzle schema to the database                                    |
| `npm run db:studio`           | Browse the database                                                         |
| `npm run import`              | Import a corpus (see above)                                                 |
| `npm run eval`                | Score the planner against hand-labelled scenarios vs. a similarity baseline |
| `npm run eval -- --json`      | The same, also writing `eval-results/eval.json` for the `/eval` page |
| `npm run plan -- "skill:level"` | Generate a path from the CLI against the bootstrap corpus (no database) |
| `npm run package`             | Build the submission ZIP from tracked files only                            |

## Evaluation

The planner is scored against learning paths a human expert wrote by hand, alongside a similarity
baseline (rank resources by similarity to the goal text, present them in similarity order — the
standard approach). Both see the same corpus and the same similarity signal.

```bash
npm run eval -- --json          # writes eval-results/eval.md and eval.json
```

Metrics: prerequisite violation rate (steps the learner was not ready for), gap coverage,
redundancy, nDCG and Kendall tau against the expert ordering. Results render at `/eval`.

Set `COHERE_API_KEY` before quoting the numbers: without it the baseline falls back to word-overlap
similarity, which understates it, and the generated report says so.

## Architecture

- **App**: Next.js 15 (App Router) + TypeScript, React, Tailwind, shadcn/ui
- **Data**: Postgres + pgvector via Drizzle ORM
- **AI/ML**: hybrid retrieval over a skill-tagged corpus, DAG-constrained beam-search planning,
  rule-based mastery updates, LLM used only for extraction and phrasing
- **Deploy**: Vercel (app) + Supabase (database)

Full design: [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md). Problem brief and rubric:
[docs/00-BRIEF.md](docs/00-BRIEF.md).

## Project layout

```
src/app/          routes and UI
src/lib/          gap model, retrieval, planner, LLM and corpus parsing
src/db/           Drizzle schema and client
scripts/          import.ts, eval.ts
data/bootstrap/   seed corpus (CSV)
docs/             brief, differentiation, architecture, plan, verification
```
