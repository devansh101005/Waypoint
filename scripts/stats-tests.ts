/**
 * Record how many tests actually pass, so the site can show the figure without
 * anyone typing it.
 *
 *   npm run stats:tests
 *
 * Runs the suite, parses the reporter's own output and writes the count. If the
 * suite fails, nothing is written — a red build must not be able to publish a
 * green number.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const vitest = path.join(root, "node_modules", "vitest", "vitest.mjs");

interface VitestJson {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  success?: boolean;
}

function main() {
  let raw: string;
  try {
    raw = execFileSync(process.execPath, [vitest, "run", "--reporter=json"], {
      cwd: root,
      env: { ...process.env, NODE_OPTIONS: "" },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 300000,
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
    }).toString();
  } catch (error) {
    const e = error as { stdout?: Buffer; stderr?: Buffer };
    console.error("✖ Test suite did not pass — not writing a test count.");
    console.error(`${e.stdout ?? ""}${e.stderr ?? ""}`.slice(-1500));
    process.exit(1);
  }

  // The JSON reporter prints one object; anything before it is noise.
  const start = raw.indexOf("{");
  if (start === -1) {
    console.error("✖ Could not find JSON in the reporter output.");
    process.exit(1);
  }

  let report: VitestJson;
  try {
    report = JSON.parse(raw.slice(start)) as VitestJson;
  } catch (error) {
    console.error("✖ Could not parse the reporter output:", error);
    process.exit(1);
  }

  const passed = report.numPassedTests ?? 0;
  const failed = report.numFailedTests ?? 0;

  if (failed > 0 || passed === 0) {
    console.error(`✖ ${failed} failing test(s) — not writing a test count.`);
    process.exit(1);
  }

  const outDir = path.join(root, "eval-results");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "tests.json"),
    `${JSON.stringify({ passed, total: report.numTotalTests ?? passed, recordedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );

  console.log(`✔ ${passed} tests passing — written to eval-results/tests.json`);
}

main();
