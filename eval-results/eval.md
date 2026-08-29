# Evaluation: Waypoint vs. similarity baseline

Corpus: **40 skills**, **41 resources**. Scored against **5 hand-labelled expert paths**.

The baseline ranks resources by similarity between the learner's stated goal and each resource's text, then presents them in similarity order — no skill tags, no prerequisite graph, no model of what the learner already knows. It sees the same corpus and the same similarity signal we do.

_Baseline similarity: Cohere `embed-v4.0`, the same embeddings our retriever uses._

## Headline

| Metric | Waypoint | Baseline | Better |
|---|---|---|---|
| Prerequisite violation rate | 0.0% | 61.7% | **Waypoint** |
| Gap coverage | 98.1% | 61.0% | **Waypoint** |
| Redundancy | 19.6% | 32.4% | **Waypoint** |
| nDCG vs. expert path | 0.831 | 0.353 | **Waypoint** |
| Ordering correlation (Kendall tau) | 0.689 | -0.053 | **Waypoint** |
| Hours prescribed | 90.4h | 104.0h | — |

## Per scenario

| Scenario | Persona | Violations (ours / base) | Coverage (ours / base) | nDCG (ours / base) |
|---|---|---|---|---|
| SCN-01 | Riya, commerce graduate | 0.0% / 50.0% | 90.6% / 84.8% | 0.725 / 0.613 |
| SCN-02 | Arjun, economics postgrad | 0.0% / 25.0% | 100.0% / 27.5% | 0.985 / 0.375 |
| SCN-03 | Meera, CS third year | 0.0% / 66.7% | 100.0% / 69.4% | 0.652 / 0.206 |
| SCN-04 | Sunil, operations executive | 0.0% / 100.0% | 100.0% / 53.8% | 0.907 / 0.167 |
| SCN-05 | Kabir, mechanical engineering student | 0.0% / 66.7% | 100.0% / 69.4% | 0.887 / 0.406 |

## What the metrics mean

- **Prerequisite violation rate** — share of steps the learner was not ready for when they reached them. Zero by construction for Waypoint: the prerequisite graph gates which resources are generated as candidates, so an infeasible step is never considered.
- **Gap coverage** — share of the learner's initial skill gap the path actually closes.
- **Redundancy** — share of teaching effort spent on skills the learner already held.
- **nDCG / Kendall tau** — agreement with the human expert's chosen resources and ordering.

_Generated 2026-08-29T07:51:05.891Z by `npm run eval` (embeddings mode)._
