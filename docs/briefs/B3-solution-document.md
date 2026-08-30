# Brief B3 — Solution Documentation (Prateek)

**Deliverable:** one PDF (or PPT exported to PDF), submitted as required deliverable #3.
**Deadline: Mon 31 Aug, 14:00.** Devansh submits the form at 18:00 and needs time to check it.

**No code, no setup.** Everything you need is in this repo's `docs/` folder and on the live site.
Read `docs/00-BRIEF.md` first — it lists exactly what HCL asked for.

## Why this one matters most

The rubric gives **Problem Understanding & Solution Design 20%**, and this document is where almost
all of that is scored. The judges read this before they open the code. A great build with a thin
document loses to an average build with a clear one.

## What HCL explicitly asked this document to cover

These six headings are quoted from the problem statement. Use them as your section headings so the
judge can tick them off:

1. **Problem understanding**
2. **Solution approach**
3. **System architecture**
4. **AI/ML techniques used**
5. **Key features and workflows**
6. **Challenges faced**

## Where the content comes from

You are not inventing any of this. Every section has a source in the repo:

| Section                  | Source                                            | What to do with it                                                                                                                         |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Problem understanding    | `docs/00-BRIEF.md`                                | Restate the problem in your own words. The key insight: learners don't lack _courses_, they lack the right **sequence**. Say that plainly. |
| Solution approach        | `README.md` top section                           | The one-line thesis: we treat this as **planning over a skill graph**, not text similarity.                                                |
| System architecture      | `docs/02-ARCHITECTURE.md` §2                      | There is a Mermaid diagram there. Redraw it in slides/draw.io — don't paste raw Mermaid code.                                              |
| AI/ML techniques         | `docs/02-ARCHITECTURE.md` §4 + `README.md`        | Listed below — this is the section to spend most effort on.                                                                                |
| Key features + workflows | `docs/PROGRESS.md` "Required features: 6/6" table | One screenshot per feature from the live site.                                                                                             |
| Challenges faced         | `docs/PROGRESS.md` "Defects the tooling caught"   | Pick 3–4 and write them as a story.                                                                                                        |

## The AI/ML section — spend the most time here

This is 20% of the rubric on its own. Five techniques, in plain language:

1. **Skill graph (DAG).** 65 skills with prerequisite edges. Everything reasons over this, not over
   course descriptions.
2. **Mastery vector + gap compiler.** A learner is a number per skill. A goal compiles to a target
   state; the difference is the gap, expanded over prerequisites.
3. **Hybrid retrieval.** Skill-tag overlap (0.5) + dense embeddings (0.3) + lexical signal (0.2),
   with an optional cross-encoder rerank. Crucially it scores against the learner's **gap**, not
   their query text.
4. **DAG-constrained beam search planner.** The prerequisite graph gates which resources can even be
   _considered_ at each step, so an infeasible ordering is structurally impossible — not filtered
   out afterwards, never generated.
5. **Grounded explanations.** Each step carries a machine-built "reasons object"; the language model
   only phrases it, and a hallucination guard rejects any sentence naming something not in that
   object.

**The line that sells it:** every other team will use an LLM to _pick courses_. We use the LLM only
to _read the learner's sentence_ and _phrase the reasons_. The actual recommendation is planning
over a graph — which is why our prerequisite violation rate is provably zero.

## Include the evaluation — this is our strongest evidence

Put this table in, prominently. Source: `eval-results/eval.md`.

| Metric                      | Waypoint  | Similarity baseline |
| --------------------------- | --------- | ------------------- |
| Prerequisite violation rate | **0.0%**  | 50.2%               |
| Gap coverage                | **93.0%** | 64.7%               |
| Redundancy                  | **16.8%** | 36.3%               |
| nDCG vs. expert path        | **0.392** | 0.170               |
| Ordering correlation        | **0.459** | 0.111               |
| Hours prescribed            | 71.3h     | 231.6h              |

Corpus: 65 skills, 126 resources, 9 hand-labelled expert paths.

Explain what the comparison is, because the fairness is the point: the baseline is the standard
approach (rank resources by similarity to the goal, present in similarity order). It sees **the same
corpus and the same embeddings** we do. We did not build a weak strawman.

## Be honest about limits — judges reward this

Include a short "Known limitations" section. Take it from `docs/PROGRESS.md`:

- Two of the nine scenarios close only part of the skill gap, because the learner's available
  hours cannot cover the whole goal. The system prescribes the realistic first phase and reports
  the route as incomplete rather than pretending to finish.
- One scenario (SCN-05, "I want to work with AI") is deliberately **unscored**: the goal is too vague
  to compile, so the system asks a clarifying question instead of guessing.

That second one is a strength, not an apology. Frame it as: _a system that guessed would score on
this case and be wrong in a way nobody could check._

## Format

- 10–16 slides, or 6–10 pages if you write it as a document. Either is fine; PDF is what's submitted.
- Screenshots from **https://waypoint-six-teal.vercel.app** — the landing page, `/start`, a generated
  route, the dashboard, and `/eval`.
- Put the live URL and the GitHub URL on the first slide.
- Team names and college on the first slide.

## When you're done

Send the PDF to Devansh by **14:00**. He reviews for technical accuracy only — he is not rewriting
it, so make it complete rather than a draft.
