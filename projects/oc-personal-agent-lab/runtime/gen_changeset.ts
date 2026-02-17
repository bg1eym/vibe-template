#!/usr/bin/env -S npx tsx
/**
 * ChangeSet generator: from out/trace.json -> out/changeset.json
 * Trace is single source of truth.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const REQUIRED_TRACE_FIELDS = ["task_id", "files_written", "changeset_id"] as const;

function main() {
  const tracePath = resolve(ROOT, "out", "trace.json");
  if (!existsSync(tracePath)) {
    console.error("gen_changeset FAIL: out/trace.json not found");
    process.exit(1);
  }
  const trace = JSON.parse(readFileSync(tracePath, "utf-8")) as Record<string, unknown>;
  for (const f of REQUIRED_TRACE_FIELDS) {
    if (trace[f] === undefined || trace[f] === null) {
      console.error(`gen_changeset FAIL: trace missing required field: ${f}`);
      process.exit(1);
    }
  }
  const taskId = String(trace.task_id);
  const changesetId = String(trace.changeset_id);
  const filesWritten = Array.isArray(trace.files_written)
    ? (trace.files_written as string[]).map(String)
    : [];

  let gitDiffSummary: string;
  const projectHasGit = existsSync(resolve(ROOT, ".git"));
  try {
    if (projectHasGit) {
      gitDiffSummary = execSync("git diff --stat -- .", {
        cwd: ROOT,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } else {
      const parentRoot = execSync("git rev-parse --show-toplevel 2>/dev/null", {
        cwd: ROOT,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      const prefix = execSync("git rev-parse --show-prefix 2>/dev/null", {
        cwd: ROOT,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      if (parentRoot && prefix) {
        gitDiffSummary = execSync(`git diff --stat -- "${prefix}"`, {
          cwd: parentRoot,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
      } else {
        gitDiffSummary = "unavailable";
      }
    }
    if (!gitDiffSummary) gitDiffSummary = "empty";
  } catch {
    gitDiffSummary = "unavailable";
  }

  const irPath = resolve(ROOT, "out", "ir.json");
  const matchPath = resolve(ROOT, "out", "match.json");
  const reportMdPath = resolve(ROOT, "artifacts", taskId, "report.md");

  const changeset = {
    changeset_id: changesetId,
    task_id: taskId,
    files_written: filesWritten,
    git_diff_summary: gitDiffSummary,
    pointers: {
      trace_path: tracePath,
      ir_path: irPath,
      match_path: matchPath,
      report_md_path: reportMdPath,
    },
  };

  const outDir = resolve(ROOT, "out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "changeset.json"), JSON.stringify(changeset, null, 2), "utf-8");
  console.log("gen:changeset OK -> out/changeset.json");
}

main();
