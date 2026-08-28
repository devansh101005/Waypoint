# 00 — BRIEF (extracted from ./Context/Screenshots, 28 Aug 2026)

Source: five screenshots of the HCL "Round 2 — PathFinder Prototype" portal. Everything below is restated from them literally; nothing is invented.

## Problem statement

**AI-Powered Personalized Learning Path Recommender**

> Design and prototype an AI-powered solution that delivers personalized learning experiences based on an individual's needs, interests, learning patterns and goals.

**Background (verbatim):** Online learning platforms offer thousands of courses across diverse domains. While recommendation systems can suggest relevant courses, learners often struggle to identify the right sequence of learning resources needed to achieve a specific goal. Different learners have different skill levels, interests, career aspirations and learning preferences, making a one-size-fits-all approach ineffective. An AI-powered Personalized Learning Path Recommender can bridge this gap by understanding a learner's profile, analyzing learning objectives, identifying skill gaps and generating a structured roadmap of courses, projects and assessments tailored to the individual.

**Task (verbatim):** Design and build an intelligent learning assistant that recommends personalized learning paths based on a learner's interests, goals, previous learning history and skill level. The solution should generate a structured learning roadmap, explain recommendations, and adapt suggestions based on user feedback and progress.

## The six required features ("What to build")

1. A conversational interface where learners describe their goals in natural language.
2. A learner profiling engine capturing interests, experience level, completed courses and objectives.
3. A recommendation engine suggesting relevant courses, projects and learning resources.
4. A personalized learning path generator with prerequisites and milestones.
5. An AI assistant that explains why each recommendation was made and answers learner queries.
6. A dashboard visualizing progress, skill development, milestones and next recommended actions.

## The five required deliverables (all five are required)

| # | Deliverable | Format / requirements |
|---|---|---|
| 1 | Source code | ZIP file. All files required to run the solution. **Exclude** virtual environments, build artifacts, large dependency folders. **Include** a README with setup and execution instructions. |
| 2 | Source code repository | GitHub URL. Must be accessible to the evaluation team. **Commit history should reflect the development process** (explicitly stated — commit hygiene is graded). |
| 3 | Solution documentation | PDF/PPT covering: problem understanding, solution approach, system architecture, AI/ML techniques used, key features and workflows, challenges faced. |
| 4 | Demo video | 3–5 minutes, submitted as URL (form placeholder suggests YouTube). Demonstrate core functionality and key features; explain the overall workflow and user experience. |
| 5 | Application access | Deployed URL if available; if not deployed, clear instructions for local setup and execution. The form also has a free-text "Local setup & execution instructions" field — fill it either way. |

## Judging rubric

| Criterion | Weight |
|---|---|
| Functionality & Feature Completeness | **25%** |
| Problem Understanding & Solution Design | **20%** |
| AI/ML Implementation | **20%** |
| Innovation & Creativity | **15%** |
| User Experience & Interface | **10%** |
| Performance & Code Quality | **10%** |

## Competition mechanics and constraints

- Submissions close **31 Aug 2026, 11:59 pm IST**; any team member can edit until then.
- Team size 3–5, all from the same college (ours: Shiv Nadar University). Current roster: Devansh Pandey (captain, dp312@snu.edu.in), Prateek Goyal (pg671@snu.edu.in), Ayush Pal (ap544@snu.edu.in). Two open slots.
- **Top 25 teams are selected on Round 2 scores only** — Round 1 tokens do not affect the shortlist.
- Qualifying to the Top 25 earns further additional points based on judges' scoring on Pitch Day (top 25 pitch to HCL leaders).
- Final winners = each member's Round 1 tokens + team's Round 2 score + Pitch Day performance.

## Strategic reading of the rubric

- Functionality (25%) + AI/ML (20%) = 45% of the score sits in "the six features exist AND the ML behind them is real." Feature completeness is the single biggest lever: **all six boxes must check**, even in degraded form.
- Problem Understanding (20%) is scored substantially through deliverable #3 (the PDF/PPT) — a non-code deliverable a teammate owns.
- The demo video is the only way judges see most features. An unfilmable feature effectively scores only in code review.
- Commit history is explicitly evaluated → small conventional commits throughout, never one squash at the end.
- ZIP exclusions (no node_modules, no build output) are explicitly called out → make the packaging script part of the plan, not a 23:30 scramble.
