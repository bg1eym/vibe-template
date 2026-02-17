# Executable Plan Draft

- **source_message_id**: 5cb40f81
- **source_ts**: 2026-02-17T10:39:35.855Z
- **task_id**: task-1771325638308
- **timestamp (UTC)**: 2026-02-17T10:54:00.443Z
- **top3 hits**:
- h1: find_ts_files
- h2: filter_src
- h3: recent_modified

## 1. Objective

目标：把 report.md 草稿升级为“可执行计划草稿”，包含 actions/files/risks/acceptance 四块

## 2. Proposed Actions (No external execution)

- Update report template in pipelines/match_stub.ts if format changes
- Enforce no_external_ops: do not execute external operations (network, shell, etc.)
- Enforce write_scope=artifacts_only: restrict writes to artifacts only
- Run npm run oc:bind to regenerate artifacts and changeset
- Review artifacts/<task_id>/report.md for Cursor edits before commit

## 3. Files to Change (Predicted)

- pipelines/match_stub.ts

**Note:** Do not modify files outside artifacts/ (write_scope=artifacts_only).

## 4. Risks & Safeguards

- No external operations (constraints.no_external_ops): no network, shell, or external process execution
- Write scope (constraints.write_scope=artifacts_only): only write under artifacts/
- Schema validation failure must be recorded in trace.errors

## 5. Acceptance Checks (Command-level)

```bash
npm run oc:bind
npm run review:check
```

**Checkpoints:**

- report.md contains 5 sections: Objective, Proposed Actions, Files to Change, Risks & Safeguards, Acceptance Checks
- source_message_id and source_ts are not unknown (when current.jsonl has user messages)
- out/trace.json errors array is empty
