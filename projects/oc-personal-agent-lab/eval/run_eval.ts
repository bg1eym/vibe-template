#!/usr/bin/env -S npx tsx
import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  existsSync,
  appendFileSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAgainst } from "../lib/validate.js";
import { classifyFailureClass } from "./classify.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const FAILURES_PATH = resolve(ROOT, "golden", "failures.jsonl");
const FAILURES_TAIL_LINES = 200;

type FailureRecord = {
  recorded_at_utc: string;
  task_id: string;
  source_message_id: string;
  source_ts: string;
  user_content: string;
  intent_type?: string;
  constraints?: Record<string, unknown>;
  acceptance?: Record<string, unknown>;
  failure_reasons: string[];
  failure_class: "expected" | "unexpected";
};

function existingSourceMessageIds(): Set<string> {
  if (!existsSync(FAILURES_PATH)) {
    return new Set();
  }
  const raw = readFileSync(FAILURES_PATH, "utf-8");
  const lines = raw.trim().split("\n").filter((l) => l.length > 0);
  const tail = lines.slice(-FAILURES_TAIL_LINES);
  const ids = new Set<string>();
  for (const line of tail) {
    try {
      const r = JSON.parse(line) as FailureRecord;
      if (r.source_message_id && r.source_message_id !== "unknown") {
        ids.add(r.source_message_id);
      }
    } catch {
      /* skip */
    }
  }
  return ids;
}

function appendFailure(record: FailureRecord) {
  const ids = existingSourceMessageIds();
  if (ids.has(record.source_message_id)) {
    return;
  }
  mkdirSync(dirname(FAILURES_PATH), { recursive: true });
  appendFileSync(FAILURES_PATH, JSON.stringify(record) + "\n", "utf-8");
}

function runEval() {
  const outDir = resolve(ROOT, "out");
  const goldenDir = resolve(ROOT, "golden");
  const artifactsDir = resolve(ROOT, "artifacts");
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
  let ir: Record<string, unknown> = {};
  let trace: { task_id?: string; errors?: string[] } = {};
  let reportContent = "";

  try {
    ir = JSON.parse(readFileSync(irPath, "utf-8")) as Record<string, unknown>;
    irValid = validateAgainst("conversation_ir", ir).ok;
    results.ir_schema = irValid;
    const constraints = ir.constraints as Record<string, unknown> | undefined;
    const acceptance = ir.acceptance as Record<string, unknown> | undefined;
    irHasStructured =
      typeof ir.intent_type === "string" &&
      constraints &&
      typeof constraints.no_external_ops === "boolean" &&
      acceptance &&
      Array.isArray(acceptance.commands) &&
      (ir.intent_type !== "unknown" ||
        (constraints.write_scope !== "unknown") ||
        ((acceptance.must_have_sections as string[] | undefined)?.length ?? 0) > 0 ||
        ((acceptance.must_include_fields as string[] | undefined)?.length ?? 0) > 0);
    constraintsParsed =
      Boolean(constraints) && constraints.write_scope !== "unknown";
    acceptanceParsed =
      Boolean(acceptance) && (acceptance.commands as unknown[] | undefined)?.length >= 2;
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
    trace = JSON.parse(readFileSync(tracePath, "utf-8")) as {
      task_id?: string;
      errors?: string[];
      pipeline_name?: string;
      policy_version?: string;
      runtime_ms?: number;
      files_written?: unknown[];
      changeset_id?: string;
    };
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

  const taskId = (trace.task_id ?? ir.task_id ?? "unknown") as string;
  const reportPath = resolve(artifactsDir, taskId, "report.md");
  if (existsSync(reportPath)) {
    reportContent = readFileSync(reportPath, "utf-8");
  }

  const failureReasons: string[] = [];
  if (results.ir_has_structured_fields !== true) {
    failureReasons.push("ir_has_structured_fields=false");
  }
  if (results.constraints_parsed !== true) {
    failureReasons.push("constraints_parsed=false");
  }
  if (results.acceptance_parsed !== true) {
    failureReasons.push("acceptance_parsed=false");
  }
  const traceErrors = trace.errors ?? [];
  if (traceErrors.length > 0) {
    failureReasons.push(
      "trace_errors:" + traceErrors.slice(0, 3).join("; ")
    );
  }
  const acceptanceObj = ir.acceptance as Record<string, unknown> | undefined;
  const mustHaveSections = acceptanceObj?.must_have_sections as string[] | undefined;
  if (mustHaveSections && mustHaveSections.length > 0) {
    const missing: string[] = [];
    for (const sec of mustHaveSections) {
      if (
        !reportContent.includes(`## ${sec}`) &&
        !reportContent.includes(`# ${sec}`)
      ) {
        missing.push(sec);
      }
    }
    if (missing.length > 0) {
      failureReasons.push("missing_sections:" + missing.join(","));
    }
  }
  const mustIncludeFields = acceptanceObj?.must_include_fields as string[] | undefined;
  if (mustIncludeFields && mustIncludeFields.length > 0) {
    const missing: string[] = [];
    for (const f of mustIncludeFields) {
      if (!reportContent.includes(f)) {
        missing.push(f);
      }
    }
    if (missing.length > 0) {
      failureReasons.push("missing_fields:" + missing.join(","));
    }
  }

  let goldenPass = 0;
  let goldenTotal = 0;
  if (existsDir(goldenDir)) {
    const files = readdirSync(goldenDir).filter((f) => f.endsWith(".jsonl") && f !== "failures.jsonl");
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

  const report: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    results,
    failure_reasons: failureReasons.length > 0 ? failureReasons : undefined,
    golden_pass: goldenPass,
    golden_total: goldenTotal,
  };
  writeFileSync(
    resolve(outDir, "eval_report.json"),
    JSON.stringify(report, null, 2),
    "utf-8"
  );

  if (failureReasons.length > 0) {
    const messages = (ir.messages as Array<{ role?: string; content?: string }>) ?? [];
    const lastUser = messages.filter((m) => m.role === "user").pop();
    const userContent = (lastUser?.content as string) ?? "";
    const record: FailureRecord = {
      recorded_at_utc: new Date().toISOString(),
      task_id: (ir.task_id as string) ?? taskId,
      source_message_id: (ir.source_message_id as string) ?? "unknown",
      source_ts: String(ir.source_ts ?? "unknown"),
      user_content: userContent,
      intent_type: ir.intent_type as string | undefined,
      constraints: ir.constraints as Record<string, unknown> | undefined,
      acceptance: ir.acceptance as Record<string, unknown> | undefined,
      failure_reasons: failureReasons,
      failure_class: classifyFailureClass(userContent),
    };
    appendFailure(record);
  }

  console.log("eval OK -> out/eval_report.json");
}

function existsDir(p: string): boolean {
  return existsSync(p);
}

function main() {
  runEval();
}

main();
