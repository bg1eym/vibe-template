#!/usr/bin/env -S npx tsx
/**
 * oc:bind - ingest from openclawd -> parse -> match -> eval -> gen:changeset
 * Output: task_id, intent, top3, trace_path, report_path
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function run(cmd: string) {
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

function runQuiet(cmd: string) {
  execSync(cmd, { cwd: ROOT, stdio: "pipe" });
}

function main() {
  const t0 = Date.now();
  run("tsx runtime/ingest_openclawd.ts");
  runQuiet("tsx pipelines/parse_conversation.ts");
  runQuiet("tsx pipelines/match_stub.ts");
  runQuiet("tsx eval/run_eval.ts");
  runQuiet("tsx runtime/gen_changeset.ts");

  const tracePath = resolve(ROOT, "out", "trace.json");
  const matchPath = resolve(ROOT, "out", "match.json");
  const irPath = resolve(ROOT, "out", "ir.json");
  if (!existsSync(tracePath) || !existsSync(matchPath)) {
    console.error("oc:bind FAIL: out/trace.json or out/match.json missing");
    process.exit(1);
  }
  const trace = JSON.parse(readFileSync(tracePath, "utf-8")) as { task_id: string; errors?: string[] };
  const match = JSON.parse(readFileSync(matchPath, "utf-8")) as {
    hits: Array<{ id: string; label: string }>;
    trace: { task_id: string };
  };
  const ir = existsSync(irPath)
    ? (JSON.parse(readFileSync(irPath, "utf-8")) as {
        intent?: string;
        source_message_id?: string;
        source_ts?: string;
      })
    : { intent: "unknown", source_message_id: "unknown", source_ts: "unknown" };

  const taskId = trace.task_id ?? match.trace?.task_id ?? "unknown";
  const intent = ir.intent ?? "unknown";
  const sourceMessageId = ir.source_message_id ?? "unknown";
  const sourceTs = ir.source_ts ?? "unknown";
  const top3 = match.hits.slice(0, 3);
  const top3Str = top3.map((h) => `${h.id}=${h.label}`).join(", ");
  const reportPath = resolve(ROOT, "artifacts", taskId, "report.md");

  console.log("---");
  console.log("task_id:", taskId);
  console.log("source_message_id:", sourceMessageId);
  console.log("source_ts:", sourceTs);
  console.log("top3:", top3Str || "h1=..., h2=..., h3=...");
  console.log("trace_path:", tracePath);
  console.log("report_path:", reportPath);
  console.log("intent:", intent);
  if (trace.errors?.length) {
    console.error("trace.errors:", trace.errors);
  }
  const totalRuntimeMs = Date.now() - t0;
  console.error("total_runtime_ms:", totalRuntimeMs);
}

main();
