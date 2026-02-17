# Executable Plan Draft

- **source_message_id**: 5cb40f81
- **source_ts**: 2026-02-17T10:39:35.855Z
- **task_id**: task-1771325027271
- **timestamp (UTC)**: 2026-02-17T10:43:48.755Z
- **top3 hits**:
- h1: find_ts_files
- h2: filter_src
- h3: recent_modified

## 1. Objective

/bind 目标：把 report.md 草稿升级为“可执行计划草稿”，包含 actions/files/risks/acceptance 四块 约束：不得执行外部操作；不得写 artifacts 之外的文件；输出必须短 验收：rep...

## 2. Proposed Actions (No external execution)

- Update report template in pipelines/match_stub.ts if format changes
- Verify conversations/current.jsonl contains valid user messages with message_id/ts
- Run npm run oc:bind to regenerate artifacts and changeset
- Run npm run review:check to validate schema and changeset fields
- Review artifacts/<task_id>/report.md for Cursor edits before commit

## 3. Files to Change (Predicted)

- pipelines/match_stub.ts

## 4. Risks & Safeguards

- Do not write outside projects/oc-personal-agent-lab directory
- Do not execute external operations (network, shell, etc.)
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
