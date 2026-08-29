#!/usr/bin/env node
// Stop hook: block the turn from ending until the test suite passes.
// Silent no-op before the project has a test script.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  /* ignore */
}
// Prevent infinite stop loops.
if (payload.stop_hook_active) process.exit(0);

const pkgPath = path.join(root, "package.json");
if (!existsSync(pkgPath)) process.exit(0);

let pkg;
try {
  pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
} catch {
  process.exit(0);
}
if (!pkg?.scripts?.test) process.exit(0);

// Run vitest's JS entry via node directly — avoids Windows .cmd spawn EINVAL.
const vitest = path.join(root, "node_modules", "vitest", "vitest.mjs");
if (!existsSync(vitest)) process.exit(0);

/**
 * Vitest must not inherit an instrumentation loader from whatever spawned this
 * hook. NODE_OPTIONS carrying `--require`/`--import` hooks loads a second copy
 * of modules into the worker, and the suite then dies at the first `describe()`
 * with "Cannot read properties of undefined (reading 'config')" — every file
 * failing at import, zero tests collected, and nothing wrong with the code.
 */
const env = { ...process.env };
delete env.NODE_OPTIONS;
delete env.NODE_REPL_EXTERNAL_MODULE;

function run() {
  try {
    const stdout = execFileSync(process.execPath, [vitest, "run", "--silent"], {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 300000,
      windowsHide: true,
    }).toString();
    return { ok: true, out: stdout };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

/**
 * Every suite failing to import with no tests collected is the runner falling
 * over, not a regression. Reporting that as "your tests are failing" sends the
 * next hour into debugging code that is fine.
 */
function looksLikeRunnerFailure(out) {
  return (
    /Tests {2}no tests/.test(out) &&
    /Cannot read properties of undefined \(reading 'config'\)/.test(out)
  );
}

let result = run();
if (!result.ok && looksLikeRunnerFailure(result.out)) {
  result = run(); // one retry; transient runner failures do not survive it
}

if (result.ok) process.exit(0);

if (looksLikeRunnerFailure(result.out)) {
  /**
   * This has only ever happened when the hook is launched by the agent harness,
   * never when the same command is run by hand, so capture the environment that
   * produced it rather than guessing again next time.
   */
  try {
    writeFileSync(
      path.join(root, ".claude", "hook-diagnostics.json"),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          cwd: process.cwd(),
          nodeVersion: process.version,
          nodeOptions: process.env.NODE_OPTIONS ?? null,
          nodeEnv: process.env.NODE_ENV ?? null,
          envKeys: Object.keys(process.env)
            .filter((k) => /^(NODE|npm|VITE|VITEST|TS)/i.test(k))
            .sort(),
          tail: result.out.slice(-1500),
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch {
    /* diagnostics are best-effort */
  }

  console.error(
    "Vitest failed to start (every suite errored at import, zero tests collected).\n" +
      "This is the test runner's environment, not the code. Verify with:\n" +
      "  node node_modules/vitest/vitest.mjs run\n" +
      "Environment captured in .claude/hook-diagnostics.json\n" +
      `${result.out.slice(-1500)}`,
  );
  process.exit(2);
}

console.error(
  `Test suite failing — fix before ending the turn:\n${result.out.slice(-6000)}`,
);
process.exit(2);
