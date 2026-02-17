#!/usr/bin/env -S npx tsx
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const GOLDEN = resolve(ROOT, "golden");

const INTENTS = [
  "find_ts_files",
  "filter_src",
  "recent_modified",
  "search_code",
  "run_tests",
  "format_code",
  "lint_check",
  "build_project",
  "open_file",
  "grep_pattern",
  "list_dir",
  "read_file",
  "write_file",
  "create_branch",
  "commit_changes",
  "push_remote",
  "pull_latest",
  "show_diff",
  "run_script",
  "install_deps",
];

function main() {
  mkdirSync(GOLDEN, { recursive: true });
  const lines: string[] = [];
  for (let i = 0; i < 20; i++) {
    const role = i % 2 === 0 ? "user" : "assistant";
    const intent = INTENTS[i % INTENTS.length];
    lines.push(JSON.stringify({ role, content: `sample_${intent}_${i}`, intent }));
  }
  writeFileSync(resolve(GOLDEN, "samples.jsonl"), lines.join("\n"), "utf-8");
  console.log("golden/samples.jsonl: 20 lines");
}

main();
