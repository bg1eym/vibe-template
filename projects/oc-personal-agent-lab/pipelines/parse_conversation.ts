#!/usr/bin/env -S npx tsx
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAgainst } from "../lib/validate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

type JsonlLine = { role: string; content: string; message_id?: string; ts?: string };

type IntentType = "plan" | "report" | "execute" | "fix" | "unknown";
type WriteScope = "artifacts_only" | "repo_only" | "unknown";
type OutputStyle = "summary" | "detailed" | "unknown";

export function extractIntentType(content: string): { value: IntentType; errors: string[] } {
  const errs: string[] = [];
  const c = content.toLowerCase();
  if (/\b(修复|bug|失败)\b/.test(content) || /\bbug\b|\bfix\b/.test(c)) return { value: "fix", errors: [] };
  if (/\b(执行|run|apply)\b/.test(content) || /\brun\b|\bapply\b/.test(c)) return { value: "execute", errors: [] };
  if (/(计划|升级)/.test(content) || /\bplan\b|\bupgrade\b/.test(c)) return { value: "plan", errors: [] };
  if (/生成[^，]*草稿/.test(content)) return { value: "plan", errors: [] };
  if (/报告/.test(content) || (/\breport\b/.test(c) && !/report\.md/.test(content))) return { value: "report", errors: [] };
  errs.push("intent_type: no keywords matched, using unknown");
  return { value: "unknown", errors: errs };
}

export function extractConstraints(content: string): {
  no_external_ops: boolean;
  write_scope: WriteScope;
  output_style: OutputStyle;
  errors: string[];
} {
  const errs: string[] = [];
  if (/do not mention constraints?|without constraints?/i.test(content)) {
    return { no_external_ops: false, write_scope: "unknown", output_style: "unknown", errors: ["constraints negated by user"] };
  }
  const no_external_ops =
    /不得执行外部操作|no-external-actions|no\s+external/i.test(content);
  let write_scope: WriteScope = "unknown";
  if (/不得写\s*artifacts\s*之外|artifacts\s*之外/i.test(content)) write_scope = "artifacts_only";
  else if (/不得写出项目目录|repo\s*only/i.test(content)) write_scope = "repo_only";
  else errs.push("constraints.write_scope: no keywords, using unknown");
  let output_style: OutputStyle = "unknown";
  if (/输出必须短|summary-only/i.test(content)) output_style = "summary";
  else errs.push("constraints.output_style: no keywords, using unknown");
  return { no_external_ops, write_scope, output_style, errors: errs };
}

export function extractAcceptance(content: string): {
  must_have_sections: string[];
  must_include_fields: string[];
  commands: string[];
  errors: string[];
} {
  const errs: string[] = [];
  if (/do not mention.*acceptance|without acceptance/i.test(content)) {
    return { must_have_sections: [], must_include_fields: [], commands: [], errors: ["acceptance negated by user"] };
  }
  const must_have_sections: string[] = [];
  if (/必须出现\s*(四个小标题|四块)|actions\/files\/risks\/acceptance/.test(content)) {
    must_have_sections.push("Proposed Actions", "Files to Change", "Risks & Safeguards", "Acceptance Checks");
  }
  const must_include_fields: string[] = [];
  if (/message_id|message\s*id/i.test(content)) must_include_fields.push("source_message_id");
  if (/\bts\b|timestamp/i.test(content)) must_include_fields.push("source_ts");
  if (/task_id|task\s*id/i.test(content)) must_include_fields.push("task_id");
  if (/top3|top\s*3/i.test(content)) must_include_fields.push("top3");
  if (/path|路径/i.test(content)) must_include_fields.push("trace_path", "report_path");
  const commands = ["npm run oc:bind", "npm run review:check"];
  return { must_have_sections, must_include_fields, commands, errors: errs };
}

function parseConversation(): unknown {
  const path = resolve(ROOT, "conversations", "current.jsonl");
  const lines = readFileSync(path, "utf-8")
    .trim()
    .split("\n")
    .filter((l) => l.length > 0);
  const raw = lines.map((line) => JSON.parse(line) as JsonlLine);
  const messages = raw.map((m) => ({ role: m.role, content: m.content }));
  const lastUser = raw.filter((m) => m.role === "user").pop();
  const content = lastUser?.content ?? "";
  const intent = content || "unknown";
  const taskId = `task-${Date.now()}`;
  const source_message_id =
    typeof lastUser?.message_id === "string" && lastUser.message_id ? lastUser.message_id : "unknown";
  const source_ts = typeof lastUser?.ts === "string" && lastUser.ts ? lastUser.ts : "unknown";

  const { value: intent_type, errors: intentErrs } = extractIntentType(content);
  const constraints = extractConstraints(content);
  const acceptance = extractAcceptance(content);
  const extraction_errors = [
    ...intentErrs,
    ...constraints.errors,
    ...acceptance.errors,
  ].filter(Boolean);

  return {
    task_id: taskId,
    messages,
    intent,
    source_message_id,
    source_ts,
    intent_type,
    constraints: {
      no_external_ops: constraints.no_external_ops,
      write_scope: constraints.write_scope,
      output_style: constraints.output_style,
    },
    acceptance: {
      must_have_sections: acceptance.must_have_sections,
      must_include_fields: acceptance.must_include_fields,
      commands: acceptance.commands,
    },
    ...(extraction_errors.length > 0 ? { extraction_errors } : {}),
  };
}

function main() {
  const ir = parseConversation();
  const result = validateAgainst("conversation_ir", ir);
  if (!result.ok) {
    console.error("IR validation failed:", result.errors);
    process.exit(1);
  }
  const outDir = resolve(ROOT, "out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "ir.json"), JSON.stringify(ir, null, 2), "utf-8");
  console.log("run:parse OK -> out/ir.json");
}

if (process.argv[1]?.includes("parse_conversation")) {
  main();
}
