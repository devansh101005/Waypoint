#!/usr/bin/env node
// PreToolUse (Bash|PowerShell): block destructive commands.
import { readFileSync } from "node:fs";

let cmd = "";
try {
  const data = JSON.parse(readFileSync(0, "utf8"));
  cmd = String(data?.tool_input?.command ?? "");
} catch {
  process.exit(0);
}
const c = cmd.toLowerCase();

const blocked = [
  // recursive deletes at dangerous roots or outside the repo
  { re: /rm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)[a-z]*\s+(\/|~|[a-z]:[\\/](?!.*hcl amplified code))/i, why: "recursive delete outside the repo" },
  { re: /remove-item\s+.*-recurse.*\s+(\/|~|[a-z]:[\\/](?!.*hcl amplified code))/i, why: "recursive delete outside the repo" },
  { re: /rmdir\s+\/s|del\s+\/[sf]/i, why: "recursive cmd.exe delete — use targeted deletes inside the repo" },
  // git history / remote destruction
  { re: /git\s+push\s+[^\n]*(--force|-f)\b[^\n]*\b(main|master)\b/i, why: "force-push to main/master" },
  { re: /git\s+reset\s+--hard/i, why: "git reset --hard discards work; use git stash or revert" },
  { re: /git\s+clean\s+-[a-z]*f/i, why: "git clean -f deletes untracked files" },
  // database / disk destruction
  { re: /drop\s+(table|database|schema)/i, why: "destructive SQL" },
  { re: /\b(mkfs|format\s+[a-z]:|diskpart)\b/i, why: "disk-format command" },
  // secrets exfiltration guard
  { re: /curl[^\n]*(-d|--data)[^\n]*\b(anthropic_api_key|cohere_api_key|database_url)\b/i, why: "sending secrets in a request body" },
];

for (const { re, why } of blocked) {
  if (re.test(c)) {
    console.error(`Blocked by pre-bash hook: ${why}. Command was: ${cmd.slice(0, 200)}`);
    process.exit(2);
  }
}
process.exit(0);
