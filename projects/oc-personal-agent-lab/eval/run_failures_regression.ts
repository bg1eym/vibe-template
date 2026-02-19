#!/usr/bin/env -S npx tsx
/**
 * Failures regression: re-parse golden/failures.jsonl (last 50), compare UNEXPECTED rates with baseline.
 * Gate only on unexpected fail rates; expected failures are display-only.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractConstraints, extractAcceptance } from "../pipelines/parse_conversation.js";
import { classifyFailureClass } from "./classify.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FAILURES_PATH = resolve(ROOT, "golden", "failures.jsonl");
const BASELINE_PATH = resolve(ROOT, "golden", "failures_baseline.json");
const MAX_SAMPLES = 50;
const RATE_THRESHOLD = 0.05;

type FailureRecord = {
  source_message_id?: string;
  user_content: string;
  failure_class?: "expected" | "unexpected";
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

function resolveFailureClass(r: FailureRecord): "expected" | "unexpected" {
  if (r.failure_class === "expected" || r.failure_class === "unexpected") {
    return r.failure_class;
  }
  return classifyFailureClass(r.user_content);
}

function computeRates(records: FailureRecord[]): {
  total_expected: number;
  total_unexpected: number;
  constraints_fail_count_expected: number;
  constraints_fail_count_unexpected: number;
  acceptance_fail_count_expected: number;
  acceptance_fail_count_unexpected: number;
  constraints_fail_rate_expected: number;
  constraints_fail_rate_unexpected: number;
  acceptance_fail_rate_expected: number;
  acceptance_fail_rate_unexpected: number;
} {
  let constraintsFailExpected = 0;
  let constraintsFailUnexpected = 0;
  let acceptanceFailExpected = 0;
  let acceptanceFailUnexpected = 0;
  let totalExpected = 0;
  let totalUnexpected = 0;

  for (const r of records) {
    const cls = resolveFailureClass(r);
    const constraints = extractConstraints(r.user_content);
    const acceptance = extractAcceptance(r.user_content);
    const constraintsFail =
      constraints.write_scope === "unknown" && !constraints.no_external_ops;
    const acceptanceFail =
      (acceptance.must_have_sections?.length ?? 0) === 0 &&
      (acceptance.must_include_fields?.length ?? 0) === 0 &&
      (acceptance.commands?.length ?? 0) < 2;

    if (cls === "expected") {
      totalExpected++;
      if (constraintsFail) constraintsFailExpected++;
      if (acceptanceFail) acceptanceFailExpected++;
    } else {
      totalUnexpected++;
      if (constraintsFail) constraintsFailUnexpected++;
      if (acceptanceFail) acceptanceFailUnexpected++;
    }
  }

  return {
    total_expected: totalExpected,
    total_unexpected: totalUnexpected,
    constraints_fail_count_expected: constraintsFailExpected,
    constraints_fail_count_unexpected: constraintsFailUnexpected,
    acceptance_fail_count_expected: acceptanceFailExpected,
    acceptance_fail_count_unexpected: acceptanceFailUnexpected,
    constraints_fail_rate_expected:
      totalExpected > 0 ? constraintsFailExpected / totalExpected : 0,
    constraints_fail_rate_unexpected:
      totalUnexpected > 0 ? constraintsFailUnexpected / totalUnexpected : 0,
    acceptance_fail_rate_expected:
      totalExpected > 0 ? acceptanceFailExpected / totalExpected : 0,
    acceptance_fail_rate_unexpected:
      totalUnexpected > 0 ? acceptanceFailUnexpected / totalUnexpected : 0,
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
  console.log(`  total_expected: ${stats.total_expected}`);
  console.log(`  total_unexpected: ${stats.total_unexpected}`);
  console.log(
    `  constraints_fail_rate_expected: ${(stats.constraints_fail_rate_expected * 100).toFixed(1)}%`
  );
  console.log(
    `  constraints_fail_rate_unexpected: ${(stats.constraints_fail_rate_unexpected * 100).toFixed(1)}%`
  );
  console.log(
    `  acceptance_fail_rate_expected: ${(stats.acceptance_fail_rate_expected * 100).toFixed(1)}%`
  );
  console.log(
    `  acceptance_fail_rate_unexpected: ${(stats.acceptance_fail_rate_unexpected * 100).toFixed(1)}%`
  );

  if (!existsSync(BASELINE_PATH)) {
    console.error("test:failures: baseline not found. Run: npm run baseline:failures");
    process.exit(1);
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8")) as {
    unexpected_failure_count?: number;
    constraints_fail_rate_unexpected?: number;
    acceptance_fail_rate_unexpected?: number;
    updated_at_utc?: string;
  };

  const constraintsDelta =
    stats.constraints_fail_rate_unexpected -
    (baseline.constraints_fail_rate_unexpected ?? 0);
  const acceptanceDelta =
    stats.acceptance_fail_rate_unexpected -
    (baseline.acceptance_fail_rate_unexpected ?? 0);

  if (constraintsDelta > RATE_THRESHOLD) {
    console.error(
      `test:failures FAIL: constraints_fail_rate_unexpected increased ${(constraintsDelta * 100).toFixed(1)}% (threshold ${RATE_THRESHOLD * 100}%)`
    );
    process.exit(1);
  }
  if (acceptanceDelta > RATE_THRESHOLD) {
    console.error(
      `test:failures FAIL: acceptance_fail_rate_unexpected increased ${(acceptanceDelta * 100).toFixed(1)}% (threshold ${RATE_THRESHOLD * 100}%)`
    );
    process.exit(1);
  }

  console.log("test:failures PASS");
}

main();
