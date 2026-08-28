# Brief B2 — Hand-Labelled Evaluation Scenarios (Ayush)

**Deadline: Sat 30 Aug, 20:00.** No code, no setup — one tab in the Waypoint Corpus sheet.

## Why this is the highest-leverage thing you can write

Every other team will claim their AI gives good recommendations. We are going to **prove** ours
does, with numbers, on camera. That proof needs a human expert's answer to compare against — and
that is what you are writing.

Devansh's evaluation harness will, for each scenario you write:

1. run the naive approach (plain similarity search, what most teams build),
2. run our approach,
3. score both against **your** expert path,
4. print a table showing ours wins.

If you write 10 good scenarios, we get a slide that says "our planner beats the standard approach on
10 expert-labelled cases." That is worth more than any extra feature. If you write zero, we lose the
strongest thing in our submission.

**Write 8–12 scenarios.** Quality over quantity — 8 careful ones beat 12 rushed ones.

## Before you start

You need the `Resources` tab (brief B1) to have real rows in it, because expert paths are written as
resource ids. Coordinate with Prateek: as soon as v1 resources exist (~Sat 13:00), you can start.
You can draft the personas and goals before then.

## Tab: `Scenarios` — columns

| Column           | What to write                                                                                                                  | Example                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `scenario_id`    | `SCN-` plus two digits                                                                                                         | `SCN-03`                                                           |
| `persona_name`   | a memorable name and one-phrase identity                                                                                       | `Riya, commerce graduate`                                          |
| `background`     | 3–5 sentences of realistic context: what they've studied, what they've actually done, what they find hard, why they want this. | —                                                                  |
| `stated_skills`  | what they already know, as `slug:level` from the `Skills` tab, comma-separated. Empty if a true beginner.                      | `python-basics:3, sql-basics:2`                                    |
| `goal`           | one sentence in the learner's own voice                                                                                        | `I want to become a data analyst and be employable in six months.` |
| `expert_path`    | **the ordered list of resource ids you would prescribe**, comma-separated. This is the ground truth.                           | `RES-008, RES-002, RES-041`                                        |
| `rationale`      | 2–3 sentences on why this order. Especially: what must come before what, and why.                                              | —                                                                  |
| `hours_per_week` | realistic study hours they can commit                                                                                          | `8`                                                                |

## How to write a good expert path

Imagine a friend with exactly this background asked you what to study, in what order, and you cared
about them not wasting six months. Then write down that answer.

Concretely:

1. **Start from what they already know.** Don't include a resource teaching something their
   `stated_skills` already cover at that level — that's the mistake we want the naive system to make
   and ours to avoid.
2. **Order matters, and it is the point.** If resource B assumes something resource A teaches, A
   comes first. Your ordering is what we score prerequisite-correctness against.
3. **6–12 resources is a good path length.** Long enough to show sequencing, short enough to be a
   real plan.
4. **Respect their hours.** A path of 200 hours for someone with 4 hours a week is a year. If the
   goal needs more time than they have, prescribe the realistic first phase and say so in
   `rationale`.
5. **Only use ids that exist** in the `Resources` tab. If the perfect resource isn't there, either
   ask Prateek to add it (best) or pick the closest one that is.

## Make the personas genuinely different from each other

The scenarios are only useful if they stress different behaviours. Aim to cover, across your set:

- a **complete beginner** with no relevant skills at all
- someone **switching fields** who has adjacent skills (e.g. knows Excel and statistics, no coding)
- someone **partially advanced** who already knows a chunk of the goal and must not be told to
  restart from the basics
- someone with a **hard time constraint** (e.g. 4 hours a week, needs a job in 3 months)
- someone whose **stated goal is vague** ("I want to work with AI") and needs interpretation
- someone with a **specific narrow goal** ("I need to build one dashboard for my job")
- at least one persona in each domain (`data-science`, `web-dev`)

Real people you know are the best source. Write down what you'd actually tell them.

## What "done" looks like

The `Scenarios` tab has 8–12 rows, every `expert_path` uses ids that exist in the `Resources` tab,
and each `rationale` explains an ordering decision rather than just describing the persona. Tell
Devansh when it's ready; if any ids don't match he'll send you the exact row numbers to fix.
