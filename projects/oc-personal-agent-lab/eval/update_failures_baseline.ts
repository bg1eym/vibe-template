#!/usr/bin/env -S npx tsx
/**
 * Update golden/failures_baseline.json from current regression stats.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractConstraints, extractAcceptance } from "../pipelines/parse_conversation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FAILURES_PATH = resolve(ROOT, "golden", "failures.jsonl");
const BASELINE_PATH = resolve(ROOT, "golden", "failures_baseline.json");
const MAX_SAMPLES = 50;

type FailureRecord = {
  source_message_id?: string;
  user_content: string;
};

function loadFailures(): FailureRecord[] {
  if (!existsSync(FAILURES_PATH)) {
    return [];
  }
  const raw = readFileSync(FAILURES_PATH, "utf-8");
  const lines = raw.trim().split("\n").filter((l) => l.length > 0);
  return lines.slice(-MAX_SAMPLES).map((line) => JSON.parse(line) as FailureRecord);
}

function main() {
  const records = loadFailures();
  let constraintsFailCount = 0;
  let acceptanceFailCount = 0;
  for (const r of records) {
    const constraints = extractConstraints(r.user_content);
    const acceptance = extractAcceptance(r.user_content);
    if (constraints.write_scope === "unknown") {
      constraintsFailCount++;
    }
    if (
      (acceptance.must_have_sections?.length ?? 0) === 0 &&
      (acceptance.must_include_fields?.length ?? 0) === 0 &&
      (acceptance.commands?.length ?? 0) < 2
    ) {
      acceptanceFailCount++;
    }
  }
  const total = records.length;
  const baseline = {
    failure_count: total,
    constraints_fail_rate: total > 0 ? constraintsFailCount / total : 0,
    acceptance_fail_rate: total > 0 ? acceptanceFailCount / total : 0,
    updated_at_utc: new Date().toISOString(),
  };
  mkdirSync(dirname(BASELINE_PATH), { recursive: true });
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2), "utf-8");
  console.log("baseline:failures OK -> golden/failures_baseline.json");
}

main();
