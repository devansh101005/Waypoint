# Evaluation: Waypoint vs. similarity baseline

Corpus: **40 skills**, **41 resources**. Scored against **5 hand-labelled expert paths**.

The baseline ranks resources by similarity between the learner's stated goal and each resource's text, then presents them in similarity order — no skill tags, no prerequisite graph, no model of what the learner already knows. It sees the same corpus and the same similarity signal we do.

> **These numbers are provisional.** No embedding key was configured, so the baseline used lexical (term-overlap) similarity. That understates it: a goal phrased as "become a front-end developer" shares no words with a course described as "document structure, semantics and forms", so the baseline scores zero on resources it would rank correctly with embeddings. Set `COHERE_API_KEY` and re-run for the comparison we intend to publish.

## Headline

| Metric | Waypoint | Baseline | Better |
|---|---|---|---|
| Prerequisite violation rate | 0.0% | 59.4% | **Waypoint** |
| Gap coverage | 100.0% | 51.9% | **Waypoint** |
| Redundancy | 17.5% | 22.7% | **Waypoint** |
| nDCG vs. expert path | 0.822 | 0.314 | **Waypoint** |
| Ordering correlation (Kendall tau) | 0.635 | 0.293 | **Waypoint** |
| Hours prescribed | 93.0h | 101.6h | — |

## Per scenario

| Scenario | Persona | Violations (ours / base) | Coverage (ours / base) | nDCG (ours / base) |
|---|---|---|---|---|
| SCN-01 | Riya, commerce graduate | 0.0% / 50.0% | 100.0% / 69.6% | 0.678 / 0.584 |
| SCN-02 | Arjun, economics postgrad | 0.0% / 25.0% | 100.0% / 34.7% | 0.985 / 0.452 |
| SCN-03 | Meera, CS third year | 0.0% / 83.3% | 100.0% / 65.1% | 0.652 / 0.213 |
| SCN-04 | Sunil, operations executive | 0.0% / 50.0% | 100.0% / 70.0% | 0.907 / 0.321 |
| SCN-05 | Kabir, mechanical engineering student | 0.0% / 88.9% | 100.0% / 20.3% | 0.887 / 0.000 |

## What the metrics mean

- **Prerequisite violation rate** — share of steps the learner was not ready for when they reached them. Zero by construction for Waypoint: the prerequisite graph gates which resources are generated as candidates, so an infeasible step is never considered.
- **Gap coverage** — share of the learner's initial skill gap the path actually closes.
- **Redundancy** — share of teaching effort spent on skills the learner already held.
- **nDCG / Kendall tau** — agreement with the human expert's chosen resources and ordering.

_Generated 2026-08-28T15:18:27.212Z by `npm run eval` (lexical mode)._
