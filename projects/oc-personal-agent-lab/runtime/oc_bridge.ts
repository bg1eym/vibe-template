#!/usr/bin/env -S npx tsx
/**
 * Simulates OC dialog input -> parse + match.
 * Output: task_id, intent, top3 hits, trace_path
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function main() {
  execSync("npm run run:parse", { cwd: ROOT, stdio: "pipe" });
  execSync("npm run run:match", { cwd: ROOT, stdio: "pipe" });

  const matchPath = resolve(ROOT, "out", "match.json");
  const tracePath = resolve(ROOT, "out", "trace.json");
  if (!existsSync(matchPath) || !existsSync(tracePath)) {
    console.error("oc:smoke FAIL: out/match.json or out/trace.json missing");
    process.exit(1);
  }
  const match = JSON.parse(readFileSync(matchPath, "utf-8")) as {
    hits: Array<{ id: string; score: number; label: string }>;
    trace: { task_id: string };
  };
  const trace = JSON.parse(readFileSync(tracePath, "utf-8")) as { task_id: string };
  const irPath = resolve(ROOT, "out", "ir.json");
  const ir = existsSync(irPath)
    ? (JSON.parse(readFileSync(irPath, "utf-8")) as { intent?: string })
    : { intent: "unknown" };

  const taskId = trace.task_id ?? match.trace?.task_id ?? "unknown";
  const intent = ir.intent ?? "unknown";
  const top3 = match.hits.slice(0, 3).map((h) => `${h.id}:${h.label}`);

  console.log("task_id:", taskId);
  console.log("intent:", intent);
  console.log("top3 hits:", top3.join(", "));
  console.log("trace_path:", tracePath);
}

main();
