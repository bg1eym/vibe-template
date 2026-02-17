#!/usr/bin/env -S npx tsx
/**
 * review:check - schema validation + changeset.json field check
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAgainst } from "../lib/validate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const REQUIRED_CHANGESET_KEYS = [
  "changeset_id",
  "task_id",
  "files_written",
  "git_diff_summary",
  "pointers",
] as const;

function main() {
  let ok = true;

  const irPath = resolve(ROOT, "out", "ir.json");
  if (existsSync(irPath)) {
    const ir = JSON.parse(readFileSync(irPath, "utf-8"));
    if (!validateAgainst("conversation_ir", ir).ok) {
      console.error("review:check FAIL: out/ir.json fails conversation_ir schema");
      ok = false;
    }
  }

  const matchPath = resolve(ROOT, "out", "match.json");
  if (existsSync(matchPath)) {
    const match = JSON.parse(readFileSync(matchPath, "utf-8"));
    if (!validateAgainst("pipeline_io", match).ok) {
      console.error("review:check FAIL: out/match.json fails pipeline_io schema");
      ok = false;
    }
  }

  const changesetPath = resolve(ROOT, "out", "changeset.json");
  if (!existsSync(changesetPath)) {
    console.error("review:check FAIL: out/changeset.json not found");
    process.exit(1);
  }
  const changeset = JSON.parse(readFileSync(changesetPath, "utf-8")) as Record<string, unknown>;
  for (const k of REQUIRED_CHANGESET_KEYS) {
    if (changeset[k] === undefined || changeset[k] === null) {
      console.error(`review:check FAIL: changeset missing required field: ${k}`);
      ok = false;
    }
  }
  const pointers = changeset.pointers as Record<string, unknown> | undefined;
  if (pointers && typeof pointers === "object") {
    for (const p of ["trace_path", "ir_path", "match_path", "report_md_path"]) {
      if (pointers[p] === undefined || pointers[p] === null) {
        console.error(`review:check FAIL: changeset.pointers missing: ${p}`);
        ok = false;
      }
    }
  }

  if (!ok) process.exit(1);
  console.log("review:check OK");
}

main();
