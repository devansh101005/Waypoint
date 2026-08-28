#!/usr/bin/env node
// PreToolUse (Write|Edit|NotebookEdit): block file writes outside the repo.
// Scratchpad/temp locations are allowed.
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

let filePath = "";
try {
  const data = JSON.parse(readFileSync(0, "utf8"));
  filePath = data?.tool_input?.file_path ?? data?.tool_input?.notebook_path ?? "";
} catch {
  process.exit(0);
}
if (!filePath) process.exit(0);

const resolved = path.resolve(filePath);
const rel = path.relative(root, resolved);
const insideRepo = !rel.startsWith("..") && !path.isAbsolute(rel);

const tmp = (process.env.TEMP || process.env.TMPDIR || "").toLowerCase();
const lower = resolved.toLowerCase();
const inTemp = (tmp && lower.startsWith(tmp)) || /[\\/]temp[\\/]claude[\\/]/.test(lower) || lower.startsWith("/tmp/");

if (!insideRepo && !inTemp) {
  console.error(`Blocked by pre-write hook: write outside the repo (${resolved}). Keep files in the project or the scratchpad.`);
  process.exit(2);
}
process.exit(0);
