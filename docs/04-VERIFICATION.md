# 04 — VERIFICATION: the tooling is the reviewer

One coder, no second pair of eyes. The compensations are mechanical, not aspirational: hooks that run without being asked, a browser-level proof requirement for "done", and an adversarial second opinion with no stake in the answer. All of it is implemented in this repo now (see file list at the bottom), not promised for later.

## 1. Hooks (`.claude/settings.json` + `.claude/hooks/*.mjs`)

All hook scripts are Node (cross-platform; no cmd/bash syntax divergence). They run relative to the project root.

| Hook | Trigger | What it does |
|---|---|---|
| `post-edit.mjs` | PostToolUse on Edit\|Write | Prettier-formats the changed file; if it's TypeScript and a `tsconfig.json` exists, runs `tsc --noEmit --incremental` and reports errors back into the turn. Skips silently before the project is scaffolded. |
| `stop-tests.mjs` | Stop | Runs `npm test` (Vitest) if a test script exists; **exit 2 blocks the turn from ending until tests pass**. Honors `stop_hook_active` to prevent loops. Skips silently before the project is scaffolded. |
| `pre-bash.mjs` | PreToolUse on Bash | Blocks destructive commands: recursive deletes outside the repo, `git push --force` to main/master, `git reset --hard`, `git clean -fdx`, `DROP TABLE/DATABASE`, disk-format commands, `del /s` outside the repo. Exit 2 with the reason. |
| `pre-write.mjs` | PreToolUse on Write\|Edit\|NotebookEdit | Blocks file writes outside the repo root (scratchpad and temp excepted). Exit 2 with the reason. |

## 2. verify-feature skill (`.claude/skills/verify-feature/SKILL.md`)

Invoked after **every** completed feature, unprompted. Protocol:

1. Start (or reuse) the dev server in background; wait for ready.
2. Drive the feature through **Playwright MCP in isolated mode** as a real user — the actual journey, not a smoke ping (type the goal into the chat, click generate, read the rendered path).
3. Screenshot the end state to the scratchpad.
4. Read browser console messages — any error = fail. Check network requests for non-2xx on app routes.
5. **UI features additionally get a Lighthouse pass via Chrome DevTools MCP** — report performance / accessibility / best-practices. **Accessibility < 90 = fail; fix before proceeding.** (Performance measured on prod builds; dev-server perf numbers are noted but don't gate.)
6. Report PASS/FAIL **with evidence** (screenshot path, console excerpt, scores). FAIL → fix → rerun. A feature is not reported complete until this passes.

## 3. Second-opinion subagent (`.claude/agents/skeptic.md`)

A fresh-context agent whose instruction is to **refute** "this feature works": it re-derives what the feature should do from the docs, then attacks edge cases in the running app (empty profile, absurd goal, double-submit, refresh mid-generation, learner who knows more than the goal). It has read + browser tools only — it cannot "fix" anything, so it has no incentive to see success. Run at every phase gate and before the freeze; its findings are triaged P0/P1/P2 into the plan.

## 4. The standing rules

1. After each feature: run verify-feature automatically; fix findings before reporting the feature complete. **Nothing is called working until the browser has proven it.**
2. Every phase gate (03-PLAN): typecheck + unit tests green (enforced by hooks anyway) + verify-feature on the phase's user path + skeptic pass at Gates 3, 4, 5, 7 + conventional commit(s) + PROGRESS.md update.
3. From Phase 3 on, the daily last verify-feature run of the night executes against the **deployed** URL, not localhost.
4. Test suite scope: unit tests concentrate on the pure logic (gap compiler, feasibility, scorer, mastery updates, import validation) where regressions are silent; UI correctness is verify-feature's job, not jsdom's.
5. Evidence over assertion in reporting: gate reports state what was run and what was observed; a skipped check is reported as skipped, never elided.

## Implemented files

```
.claude/settings.json                 hooks wired (plugins preserved)
.claude/hooks/post-edit.mjs           format + typecheck
.claude/hooks/stop-tests.mjs          blocking test gate
.claude/hooks/pre-bash.mjs            destructive-command guard
.claude/hooks/pre-write.mjs           out-of-repo write guard
.claude/skills/verify-feature/SKILL.md
.claude/agents/skeptic.md
```
