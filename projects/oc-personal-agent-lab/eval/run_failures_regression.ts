#!/usr/bin/env -S npx tsx
/**
 * Failures regression: re-parse golden/failures.jsonl (last 50), compare rates with baseline.
 * Exit 1 if fail rate increases > 5%.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractConstraints, extractAcceptance } from "../pipelines/parse_conversation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FAILURES_PATH = resolve(ROOT, "golden", "failures.jsonl");
const BASELINE_PATH = resolve(ROOT, "golden", "failures_baseline.json");
const MAX_SAMPLES = 50;
const RATE_THRESHOLD = 0.05;

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
  const tail = lines.slice(-MAX_SAMPLES);
  const records: FailureRecord[] = [];
  for (const line of tail) {
    try {
      records.push(JSON.parse(line) as FailureRecord);
    } catch {
      /* skip */
    }
  }
  return records;
}

function computeRates(records: FailureRecord[]): {
  total: number;
  constraints_fail_count: number;
  acceptance_fail_count: number;
  constraints_fail_rate: number;
  acceptance_fail_rate: number;
} {
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
  return {
    total,
    constraints_fail_count: constraintsFailCount,
    acceptance_fail_count: acceptanceFailCount,
    constraints_fail_rate: total > 0 ? constraintsFailCount / total : 0,
    acceptance_fail_rate: total > 0 ? acceptanceFailCount / total : 0,
  };
}

function main() {
  const records = loadFailures();
  if (records.length === 0) {
    console.log("test:failures: no failure records, skipping");
    process.exit(0);
  }

  const stats = computeRates(records);
  console.log("test:failures: regression stats");
  console.log(`  total: ${stats.total}`);
  console.log(
    `  constraints_fail_count: ${stats.constraints_fail_count} (${(stats.constraints_fail_rate * 100).toFixed(1)}%)`
  );
  console.log(
    `  acceptance_fail_count: ${stats.acceptance_fail_count} (${(stats.acceptance_fail_rate * 100).toFixed(1)}%)`
  );

  if (!existsSync(BASELINE_PATH)) {
    console.error("test:failures: baseline not found. Run: npm run baseline:failures");
    process.exit(1);
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8")) as {
    failure_count: number;
    constraints_fail_rate: number;
    acceptance_fail_rate: number;
    updated_at_utc: string;
  };

  const constraintsDelta = stats.constraints_fail_rate - baseline.constraints_fail_rate;
  const acceptanceDelta = stats.acceptance_fail_rate - baseline.acceptance_fail_rate;

  if (constraintsDelta > RATE_THRESHOLD) {
    console.error(
      `test:failures FAIL: constraints_fail_rate increased ${(constraintsDelta * 100).toFixed(1)}% (threshold ${RATE_THRESHOLD * 100}%)`
    );
    process.exit(1);
  }
  if (acceptanceDelta > RATE_THRESHOLD) {
    console.error(
      `test:failures FAIL: acceptance_fail_rate increased ${(acceptanceDelta * 100).toFixed(1)}% (threshold ${RATE_THRESHOLD * 100}%)`
    );
    process.exit(1);
  }

  console.log("test:failures PASS");
}

main();
