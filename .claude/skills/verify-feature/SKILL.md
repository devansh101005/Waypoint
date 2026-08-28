---
name: verify-feature
description: Browser-level proof that a completed feature works — drive the real user path via Playwright MCP, check console/network, run Lighthouse on UI features, and report pass/fail with evidence. Run after every completed feature and at every phase gate, unprompted.
---

# verify-feature

A feature is not "done" until this protocol passes. Never report a feature complete on the basis of code reading or unit tests alone — the browser is the referee.

## Inputs

When invoked, establish: (1) the feature just completed and its intended user path (from the phase description in docs/03-PLAN.md or the task at hand); (2) target URL — default `http://localhost:3000`; use the deployed URL when the gate calls for it.

## Protocol

1. **Server.** If the target is localhost and the dev server is not running, start it in a background Bash task (`npm run dev`) and wait for the ready line. Reuse an already-running server.
2. **Drive the real user path** with Playwright MCP (isolated mode). Exercise the journey a learner would take — type real text into the chat, click the real buttons, wait for the real render. Assert on visible outcomes (path items rendered, explanation text present, diff callout shown), not just HTTP 200s.
3. **Screenshot** the end state to the scratchpad directory; keep the path for the report.
4. **Console check:** read browser console messages. Any `error`-level message = FAIL (warnings: note them). 
5. **Network check:** list network requests; any non-2xx/3xx response on `/api/*` routes = FAIL.
6. **Lighthouse (UI features only):** run a Lighthouse audit via Chrome DevTools MCP (`lighthouse_audit`) on the feature's page. Report performance, accessibility, and best-practices scores.
   - **Accessibility < 90 = FAIL.** Fix the specific findings (contrast, labels, roles) before proceeding.
   - Performance is gating only on production builds/deployed URL; on dev servers record the number but do not gate on it.
7. **Report** in this exact shape:

```
VERIFY: <feature> — PASS | FAIL
Path exercised: <steps>
Evidence: <screenshot path>
Console: clean | <excerpt>
Network: clean | <failures>
Lighthouse (if UI): perf X / a11y Y / best-practices Z
```

8. On FAIL: fix, then rerun the full protocol. Only a PASS run ends the feature.

## Rules

- Isolated browser state every run (no leftover localStorage smearing results).
- If the feature cannot be exercised end-to-end (e.g., missing Track B data), report exactly what was substituted (fixture data) — never silently narrow the test.
- At phase gates 3, 4, 5 and 7 (per docs/03-PLAN.md), follow with the `skeptic` agent for a second opinion.
