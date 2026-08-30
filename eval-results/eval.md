# Evaluation: Waypoint vs. similarity baseline

Corpus: **65 skills**, **126 resources**. Scored against **9 hand-labelled expert paths**.

The baseline ranks resources by similarity between the learner's stated goal and each resource's text, then presents them in similarity order — no skill tags, no prerequisite graph, no model of what the learner already knows. It sees the same corpus and the same similarity signal we do.

_Baseline similarity: Cohere `embed-v4.0`, the same embeddings our retriever uses._

## Headline

| Metric | Waypoint | Baseline | Better |
|---|---|---|---|
| Prerequisite violation rate | 0.0% | 50.2% | **Waypoint** |
| Gap coverage | 93.0% | 64.7% | **Waypoint** |
| Redundancy | 16.8% | 36.3% | **Waypoint** |
| nDCG vs. expert path | 0.392 | 0.170 | **Waypoint** |
| Ordering correlation (Kendall tau) | 0.459 | 0.111 | **Waypoint** |
| Hours prescribed | 71.3h | 231.6h | — |

## Per scenario

| Scenario | Persona | Violations (ours / base) | Coverage (ours / base) | nDCG (ours / base) |
|---|---|---|---|---|
| SCN-01 | Meera, first-year college student | 0.0% / 60.0% | 100.0% / 76.9% | 0.312 / 0.188 |
| SCN-02 | Riya, commerce graduate in an accounts role | 0.0% / 55.6% | 72.0% / 83.2% | 0.245 / 0.125 |
| SCN-03 | Arjun, backend engineer moving into ML | 0.0% / 33.3% | 65.0% / 58.6% | 0.317 / 0.164 |
| SCN-04 | Sana, retail supervisor with a hard deadline | 0.0% / 100.0% | 100.0% / 21.2% | 0.202 / 0.147 |
| SCN-06 | Farid, operations manager with one specific need | 0.0% / 66.7% | 100.0% / 62.5% | 0.139 / 0.235 |
| SCN-07 | Nikhil, mechanical engineering graduate switching to web | 0.0% / 44.4% | 100.0% / 63.5% | 0.603 / 0.153 |
| SCN-08 | Tanvi, self-taught developer stuck at intermediate | 0.0% / 22.2% | 100.0% / 63.4% | 0.730 / 0.079 |
| SCN-09 | Rohan, front-end developer moving to full-stack | 0.0% / 36.4% | 100.0% / 53.2% | 0.682 / 0.182 |
| SCN-10 | Priya, marketing associate maintaining the company site | 0.0% / 33.3% | 100.0% / 100.0% | 0.295 / 0.253 |

## What the metrics mean

- **Prerequisite violation rate** — share of steps the learner was not ready for when they reached them. Zero by construction for Waypoint: the prerequisite graph gates which resources are generated as candidates, so an infeasible step is never considered.
- **Gap coverage** — share of the learner's initial skill gap the path actually closes.
- **Redundancy** — share of teaching effort spent on skills the learner already held.
- **nDCG / Kendall tau** — agreement with the human expert's chosen resources and ordering.

**SCN-05 was not scored, and that is the intended behaviour.** Its goal — "I want to work with AI." — is too vague to compile into a destination, so the intake asked a clarifying question rather than inventing one:

> What kind of AI work appeals to you most—building machine learning models, analyzing data, or integrating AI into software applications?

A system that guessed here would score on this scenario and be wrong in a way nobody could check. There is nothing to compare against an expert path until the learner answers.

_Generated 2026-08-30T19:27:57.804Z by `npm run eval` (embeddings mode)._
