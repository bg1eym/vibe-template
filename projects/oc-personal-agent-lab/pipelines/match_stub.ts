#!/usr/bin/env -S npx tsx
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAgainst } from "../lib/validate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const MAX_OBJECTIVE_LEN = 140;

function normalizeObjective(intent: string): string {
  let s = intent.trim();
  if (!s || s === "unknown") return "Execute pipeline and produce report.";
  s = s.replace(/^\[[^\]]*\]\s*/i, "");
  s = s.replace(/^\/bind\s*/i, "");
  const constraintIdx = s.search(/约束[：:]/);
  if (constraintIdx >= 0) s = s.slice(0, constraintIdx).trim();
  const acceptIdx = s.search(/验收[：:]/);
  if (acceptIdx >= 0) s = s.slice(0, acceptIdx).trim();
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > MAX_OBJECTIVE_LEN) s = s.slice(0, MAX_OBJECTIVE_LEN - 3) + "...";
  if (!s) return "Execute pipeline and produce report.";
  if (s.startsWith("/")) s = s.slice(1).trim();
  if (s.length > 0 && /^[a-z]/.test(s)) s = s[0].toUpperCase() + s.slice(1);
  return s;
}

type IRConstraints = { no_external_ops?: boolean; write_scope?: string; output_style?: string };
type IRAcceptance = {
  must_have_sections?: string[];
  must_include_fields?: string[];
  commands?: string[];
};

function buildExecutablePlanDraft(opts: {
  sourceMessageId: string;
  sourceTs: string;
  taskId: string;
  timestamp: string;
  top3Lines: string;
  objective: string;
  constraints: IRConstraints;
  acceptance: IRAcceptance;
}): string {
  const { sourceMessageId, sourceTs, taskId, timestamp, top3Lines, objective, constraints, acceptance } = opts;
  const noExt = constraints.no_external_ops ?? false;
  const writeScope = constraints.write_scope ?? "unknown";

  const actions = [
    "Update report template in pipelines/match_stub.ts if format changes",
    noExt ? "Enforce no_external_ops: do not execute external operations (network, shell, etc.)" : "Do not execute external operations",
    writeScope !== "unknown" ? `Enforce write_scope=${writeScope}: restrict writes to ${writeScope === "artifacts_only" ? "artifacts only" : "repo only"}` : "Verify conversations/current.jsonl contains valid user messages with message_id/ts",
    "Run npm run oc:bind to regenerate artifacts and changeset",
    "Review artifacts/<task_id>/report.md for Cursor edits before commit",
  ].slice(0, 5);

  let filesToChange = ["pipelines/match_stub.ts"];
  if (writeScope === "artifacts_only") {
    filesToChange = ["pipelines/match_stub.ts"];
  }
  const filesNote = writeScope === "artifacts_only" ? "\n\n**Note:** Do not modify files outside artifacts/ (write_scope=artifacts_only)." : "";

  const risks = [
    noExt ? "No external operations (constraints.no_external_ops): no network, shell, or external process execution" : "Do not execute external operations (network, shell, etc.)",
    writeScope === "artifacts_only" ? "Write scope (constraints.write_scope=artifacts_only): only write under artifacts/" : writeScope === "repo_only" ? "Write scope (constraints.write_scope=repo_only): only write within project directory" : "Do not write outside projects/oc-personal-agent-lab directory",
    "Schema validation failure must be recorded in trace.errors",
  ];

  const cmds = acceptance.commands && acceptance.commands.length >= 2
    ? acceptance.commands
    : ["npm run oc:bind", "npm run review:check"];
  const sections = acceptance.must_have_sections?.length
    ? acceptance.must_have_sections
    : ["Proposed Actions", "Files to Change", "Risks & Safeguards", "Acceptance Checks"];
  const checks = [
    `report.md contains 5 sections: Objective, ${sections.join(", ")}`,
    "source_message_id and source_ts are not unknown (when current.jsonl has user messages)",
    "out/trace.json errors array is empty",
  ];
  if (acceptance.must_include_fields?.length) {
    checks.push(`Report must include: ${acceptance.must_include_fields.join(", ")}`);
  }

  return `# Executable Plan Draft

- **source_message_id**: ${sourceMessageId}
- **source_ts**: ${sourceTs}
- **task_id**: ${taskId}
- **timestamp (UTC)**: ${timestamp}
- **top3 hits**:
${top3Lines}

## 1. Objective

${objective}

## 2. Proposed Actions (No external execution)

${actions.map((a) => `- ${a}`).join("\n")}

## 3. Files to Change (Predicted)

${filesToChange.map((f) => `- ${f}`).join("\n")}${filesNote}

## 4. Risks & Safeguards

${risks.map((r) => `- ${r}`).join("\n")}

## 5. Acceptance Checks (Command-level)

\`\`\`bash
${cmds.join("\n")}
\`\`\`

**Checkpoints:**

${checks.map((c) => `- ${c}`).join("\n")}
`;
}

const DEFAULT_CONSTRAINTS: IRConstraints = {
  no_external_ops: false,
  write_scope: "unknown",
  output_style: "unknown",
};
const DEFAULT_ACCEPTANCE: IRAcceptance = {
  must_have_sections: [],
  must_include_fields: [],
  commands: ["npm run oc:bind", "npm run review:check"],
};

function matchStub(): unknown {
  const t0 = Date.now();
  const irPath = resolve(ROOT, "out", "ir.json");
  let ir: {
    task_id?: string;
    intent?: string;
    source_message_id?: string;
    source_ts?: string;
    constraints?: IRConstraints;
    acceptance?: IRAcceptance;
    extraction_errors?: string[];
  };
  try {
    ir = JSON.parse(readFileSync(irPath, "utf-8"));
  } catch {
    ir = {
      task_id: `task-${Date.now()}`,
      intent: "unknown",
      source_message_id: "unknown",
      source_ts: "unknown",
      constraints: DEFAULT_CONSTRAINTS,
      acceptance: DEFAULT_ACCEPTANCE,
    };
  }
  const taskId = ir.task_id ?? `task-${Date.now()}`;
  const intent = ir.intent ?? "unknown";
  const sourceMessageId = ir.source_message_id ?? "unknown";
  const sourceTs = ir.source_ts ?? "unknown";
  const constraints = { ...DEFAULT_CONSTRAINTS, ...ir.constraints };
  const acceptance = { ...DEFAULT_ACCEPTANCE, ...ir.acceptance };
  const hits = [
    { id: "h1", score: 0.9, label: "find_ts_files" },
    { id: "h2", score: 0.7, label: "filter_src" },
    { id: "h3", score: 0.5, label: "recent_modified" },
  ];
  const runtimeMs = Date.now() - t0;

  const artifactsDir = resolve(ROOT, "artifacts", taskId);
  mkdirSync(artifactsDir, { recursive: true });
  const reportMdPath = resolve(artifactsDir, "report.md");
  const reportRel = `artifacts/${taskId}/report.md`;
  const timestamp = new Date().toISOString();
  const top3Lines = hits.slice(0, 3).map((h) => `- ${h.id}: ${h.label}`).join("\n");
  const objective = normalizeObjective(intent);
  const reportMd = buildExecutablePlanDraft({
    sourceMessageId,
    sourceTs,
    taskId,
    timestamp,
    top3Lines,
    objective,
    constraints,
    acceptance,
  });
  writeFileSync(reportMdPath, reportMd, "utf-8");

  const errors: string[] = [];
  if (sourceMessageId === "unknown" || sourceTs === "unknown") {
    errors.push("source_message_id or source_ts unavailable: last user message in current.jsonl lacks message_id/ts");
  }
  if (ir.extraction_errors?.length) {
    errors.push(...ir.extraction_errors);
  }
  const trace = {
    task_id: taskId,
    pipeline_name: "match_stub",
    policy_version: "0.1.0",
    runtime_ms: runtimeMs,
    errors,
    files_written: [reportRel],
    changeset_id: taskId,
  };
  const output = {
    hits,
    trace,
    ui_state: {},
    metrics: { hit_count: hits.length },
  };
  const result = validateAgainst("pipeline_io", output);
  if (!result.ok) {
    console.error("Pipeline IO validation failed:", result.errors);
    process.exit(1);
  }
  const outDir = resolve(ROOT, "out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "match.json"), JSON.stringify(output, null, 2), "utf-8");
  writeFileSync(resolve(outDir, "trace.json"), JSON.stringify(trace, null, 2), "utf-8");
  return output;
}

function main() {
  matchStub();
  console.log("run:match OK -> out/match.json, out/trace.json");
}

main();
