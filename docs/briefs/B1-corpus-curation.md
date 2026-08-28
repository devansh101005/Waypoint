# Brief B1 — Course & Resource Corpus (Prateek + Ayush)

**You do not need to install anything, open the code, or run the project.** Everything happens in
one Google Sheet. This is the single most valuable non-code contribution to the submission: the
recommender can only recommend what is in this sheet.

**Deadlines** 

- **Sat 29 Aug, 11:00** — `Skills` tab done (~40–60 rows)
- **Sat 29 Aug, 13:00** — `Resources` tab v1 (60+ rows)
- **Sat 29 Aug, 20:00** — `Resources` tab v2 (150+ rows total)

Devansh is blocked on these times. Partial and on time beats complete and late — fill what you have
by the deadline and keep adding.

## Set up (5 minutes)

Create one Google Sheet named **Waypoint Corpus** with three tabs named exactly `Skills`,
`Resources`, `Scenarios` (Ayush owns `Scenarios` — see brief B2). Share it with Devansh with edit
access. Type the column headers exactly as written below, in the same order, in row 1.

## Domains

Cover exactly two domains so each is deep rather than both shallow:

- `data-science` — becoming a data analyst / data scientist
- `web-dev` — becoming a front-end or full-stack web developer

Use those exact strings in the `domain` column. Do not add a third domain unless Devansh says so.

## Tab 1: `Skills` — do this first

A "skill" is a single teachable capability, not a whole course. "SQL Joins" is a skill; "Data
Science" is not (too big); "Left joins in MySQL" is not (too small). Aim for a skill that a learner
could plausibly get good at in 2–15 hours.

| Column         | What to write                                                                                                       | Example                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `slug`         | lowercase, words joined by hyphens, unique, no spaces                                                               | `sql-joins`                                    |
| `name`         | how it should appear on screen                                                                                      | `SQL Joins`                                    |
| `domain`       | `data-science` or `web-dev`                                                                                         | `data-science`                                 |
| `prereq_slugs` | slugs from **this same tab** that a learner should know first, comma-separated. Leave empty for entry-level skills. | `sql-basics`                                   |
| `description`  | one sentence on what the skill is                                                                                   | `Combining tables with inner and outer joins.` |

**Rules that will cause errors if broken**

1. Every slug in `prereq_slugs` must exist in the `slug` column of this tab. No typos.
2. No circular prerequisites. If A requires B, then B (or anything B requires) must not require A.
3. A skill cannot list itself as its own prerequisite.
4. Slugs must be lowercase with hyphens only — no capitals, spaces, or underscores.

**Getting the prerequisites right matters more than getting lots of rows.** The prerequisite links
are what makes our product different from every other team's. Think: "if someone tried to learn this
without knowing X first, would they be lost?" If yes, X is a prerequisite.

There are already ~40 skills seeded in the system for both domains. Ask Devansh for the current list
and **extend it** rather than starting from scratch — reuse those exact slugs where they fit.

## Tab 2: `Resources`

Real, free-or-freemium learning resources: courses, videos, articles, projects, assessments.

| Column            | What to write                                                                                                      | Example                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `id`              | `RES-` plus three digits, unique, never reused                                                                     | `RES-041`                        |
| `title`           | the real published title                                                                                           | `SQL for Data Analysis`          |
| `url`             | the real link, no duplicates across rows                                                                           | `https://mode.com/sql-tutorial/` |
| `provider`        | who publishes it                                                                                                   | `Mode Analytics`                 |
| `type`            | exactly one of: `course`, `video`, `article`, `project`, `assessment`                                              | `course`                         |
| `description`     | 2–4 sentences **in your own words** saying what it actually teaches and who it suits. Do not paste marketing copy. | —                                |
| `difficulty`      | whole number 1–5. 1 = suitable for a total beginner, 5 = advanced.                                                 | `2`                              |
| `est_hours`       | honest estimate of hours to complete                                                                               | `12`                             |
| `skills_taught`   | which skills it teaches and to what level, as `slug:level`, comma-separated. Level 1–5. **At least one required.** | `sql-joins:3, sql-basics:4`      |
| `skills_required` | what a learner must already know, as `slug:level`. Empty if none.                                                  | `sql-basics:2`                   |
| `quality`         | your judgement 1–5 of how good it is                                                                               | `4`                              |
| `notes`           | anything you want to flag to Devansh                                                                               | —                                |

**How to think about levels (1–5).** Level is _how far this resource takes you in that skill_:
1 = you've heard of it, 2 = you can follow a tutorial, 3 = you can use it on your own work,
4 = you're comfortable and know the pitfalls, 5 = you could teach it.

**Rules that will cause errors if broken**

1. Every slug used in `skills_taught` / `skills_required` must exist in the `Skills` tab.
2. Levels must be whole numbers 1–5.
3. No two rows may share a URL, and no two rows may share an id.
4. If a resource both requires and teaches the same skill, the taught level must be **higher** than
   the required level (that's a "deepening" resource — fine). Same or lower is an error, because the
   learner would gain nothing.
5. Every resource must teach at least one skill, otherwise it can never be recommended.

**Quality bar.** 40 well-tagged resources beat 300 badly tagged ones. The tags are what the system
reasons over; the title is just a label. Prefer resources that are: free or have a free tier,
in English, still online, and specific enough to tag confidently.

**Coverage matters more than volume.** Before adding a fifth beginner Python course, check whether
any resource teaches the skills nobody has covered yet. Every skill in the `Skills` tab should be
taught by at least one resource, or a learner can never complete a path through it. When you finish
a batch, sort by `skills_taught` and look for gaps.

## When you're done with a batch

Tell Devansh in the group chat: "Corpus v1 ready, N resources." He runs an automatic check. If
anything is wrong he will send you a list that looks like:

```
resources.csv — 2 problems:
  • row 47, column "skills_taught": unknown skill slug "sql-join" — add it to the Skills tab first
  • row 51, column "url": duplicate url — already used on row 22
```

Row numbers match the row numbers in your sheet exactly (row 1 is the header). Fix those rows and
tell him it's ready again. Nothing gets imported until the sheet is clean, so a quick fix round is
normal — it is not a sign anything went wrong.
