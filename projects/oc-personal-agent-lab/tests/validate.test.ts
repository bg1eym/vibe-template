import { describe, it, expect } from "vitest";
import { validateAgainst } from "../lib/validate.js";

describe("validate", () => {
  it("conversation_ir passes valid IR", () => {
    const ir = {
      task_id: "t1",
      messages: [{ role: "user", content: "hi" }],
      intent: "greet",
      source_message_id: "abc123",
      source_ts: "2026-02-17T10:00:00.000Z",
      intent_type: "unknown",
      constraints: { no_external_ops: false, write_scope: "unknown", output_style: "unknown" },
      acceptance: {
        must_have_sections: [],
        must_include_fields: [],
        commands: ["npm run oc:bind", "npm run review:check"],
      },
    };
    expect(validateAgainst("conversation_ir", ir).ok).toBe(true);
  });

  it("conversation_ir fails missing task_id", () => {
    const ir = {
      messages: [],
      intent: "x",
      source_message_id: "unknown",
      source_ts: "unknown",
      intent_type: "unknown",
      constraints: { no_external_ops: false, write_scope: "unknown", output_style: "unknown" },
      acceptance: {
        must_have_sections: [],
        must_include_fields: [],
        commands: ["npm run oc:bind", "npm run review:check"],
      },
    };
    expect(validateAgainst("conversation_ir", ir).ok).toBe(false);
  });

  it("pipeline_io passes valid output", () => {
    const out = {
      hits: [{ id: "h1", score: 0.9, label: "x" }],
      trace: {
        task_id: "t1",
        pipeline_name: "match_stub",
        policy_version: "0.1.0",
        runtime_ms: 10,
        errors: [],
        files_written: ["artifacts/t1/report.md"],
        changeset_id: "t1",
      },
      ui_state: {},
      metrics: {},
    };
    expect(validateAgainst("pipeline_io", out).ok).toBe(true);
  });

  it("policy passes placeholder", () => {
    const p = {
      require_no_input: false,
      workspace_root: "/tmp",
      skills_allowlist: [],
      trace_required: true,
    };
    expect(validateAgainst("policy", p).ok).toBe(true);
  });
});
