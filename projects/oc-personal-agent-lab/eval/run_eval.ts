#!/usr/bin/env -S npx tsx
import { readFileSync, mkdirSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAgainst } from "../lib/validate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function runEval() {
  const outDir = resolve(ROOT, "out");
  const goldenDir = resolve(ROOT, "golden");
  mkdirSync(outDir, { recursive: true });

  const irPath = resolve(outDir, "ir.json");
  const matchPath = resolve(outDir, "match.json");
  const tracePath = resolve(outDir, "trace.json");

  const results: Record<string, boolean> = {};
  let irValid = false;
  let matchValid = false;
  let traceValid = false;

  let irHasStructured = false;
  let constraintsParsed = false;
  let acceptanceParsed = false;
  try {
    const ir = JSON.parse(readFileSync(irPath, "utf-8"));
    irValid = validateAgainst("conversation_ir", ir).ok;
    results.ir_schema = irValid;
    irHasStructured =
      typeof ir.intent_type === "string" &&
      ir.constraints &&
      typeof ir.constraints.no_external_ops === "boolean" &&
      ir.acceptance &&
      Array.isArray(ir.acceptance.commands);
    constraintsParsed = ir.constraints && ir.constraints.write_scope !== "unknown";
    acceptanceParsed = ir.acceptance && ir.acceptance.commands?.length >= 2;
  } catch {
    results.ir_schema = false;
  }
  results.ir_has_structured_fields = irHasStructured;
  results.constraints_parsed = constraintsParsed;
  results.acceptance_parsed = acceptanceParsed;

  try {
    const match = JSON.parse(readFileSync(matchPath, "utf-8"));
    matchValid = validateAgainst("pipeline_io", match).ok;
    results.match_schema = matchValid;
  } catch {
    results.match_schema = false;
  }

  try {
    const trace = JSON.parse(readFileSync(tracePath, "utf-8"));
    const hasRequired =
      typeof trace.task_id === "string" &&
      typeof trace.pipeline_name === "string" &&
      typeof trace.policy_version === "string" &&
      typeof trace.runtime_ms === "number" &&
      Array.isArray(trace.errors) &&
      Array.isArray(trace.files_written) &&
      typeof trace.changeset_id === "string";
    traceValid = hasRequired;
    results.trace_required_fields = traceValid;
  } catch {
    results.trace_required_fields = false;
  }

  let goldenPass = 0;
  let goldenTotal = 0;
  if (existsDir(goldenDir)) {
    const files = readdirSync(goldenDir).filter((f) => f.endsWith(".jsonl"));
    for (const f of files) {
      const lines = readFileSync(resolve(goldenDir, f), "utf-8")
        .trim()
        .split("\n")
        .filter((l) => l.length > 0);
      for (const line of lines) {
        goldenTotal++;
        try {
          JSON.parse(line);
          goldenPass++;
        } catch {
          /* invalid jsonl line */
        }
      }
    }
  }
  results.golden_parseable = goldenTotal === 0 ? true : goldenPass === goldenTotal;

  const report = {
    timestamp: new Date().toISOString(),
    results,
    golden_pass: goldenPass,
    golden_total: goldenTotal,
  };
  writeFileSync(resolve(outDir, "eval_report.json"), JSON.stringify(report, null, 2), "utf-8");
  console.log("eval OK -> out/eval_report.json");
}

function existsDir(p: string): boolean {
  return existsSync(p);
}

function main() {
  runEval();
}

main();
