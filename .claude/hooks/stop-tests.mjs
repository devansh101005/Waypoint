#!/usr/bin/env node
// Stop hook: block the turn from ending until the test suite passes.
// Silent no-op before the project has a test script.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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
try {
  execFileSync(process.execPath, [vitest, "run", "--silent"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 300000,
    windowsHide: true,
  });
  process.exit(0);
} catch (e) {
  const out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  console.error(
    `Test suite failing — fix before ending the turn:\n${out.slice(-6000)}`,
  );
  process.exit(2);
}
