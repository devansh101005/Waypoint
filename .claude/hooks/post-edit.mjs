#!/usr/bin/env node
// PostToolUse (Edit|Write): format the changed file, then typecheck if it's TS.
// Silent no-op before the project is scaffolded.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
let input = "";
try {
  input = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}

let filePath = "";
try {
  const data = JSON.parse(input);
  filePath = data?.tool_input?.file_path ?? "";
} catch {
  process.exit(0);
}
if (!filePath) process.exit(0);

// Only act inside the repo and only once a Node project exists.
const rel = path.relative(root, path.resolve(filePath));
if (rel.startsWith("..") || !existsSync(path.join(root, "package.json")))
  process.exit(0);

// Invoke local tools' JS entries via node directly — avoids Windows .cmd
// spawn issues (EINVAL) and shell interpolation entirely.
const bins = {
  prettier: path.join(root, "node_modules", "prettier", "bin", "prettier.cjs"),
  tsc: path.join(root, "node_modules", "typescript", "bin", "tsc"),
};
const ext = path.extname(filePath).toLowerCase();
const formattable = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".css",
  ".json",
  ".md",
];
const run = (bin, args) => {
  if (!existsSync(bin)) return { ok: true, out: "" };
  try {
    return {
      ok: true,
      out: execFileSync(process.execPath, [bin, ...args], {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 90000,
        windowsHide: true,
      }).toString(),
    };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

if (formattable.includes(ext) && existsSync(filePath)) {
  run(bins.prettier, ["--write", filePath]);
}

if (
  (ext === ".ts" || ext === ".tsx") &&
  existsSync(path.join(root, "tsconfig.json"))
) {
  const res = run(bins.tsc, ["--noEmit", "--incremental", "--pretty", "false"]);
  if (!res.ok) {
    // stderr + exit 2 feeds the errors back to Claude to fix now.
    console.error(
      `Typecheck failed after editing ${rel}:\n${res.out.slice(0, 6000)}`,
    );
    process.exit(2);
  }
}
process.exit(0);
