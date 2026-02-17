# OC 产出 → Cursor review → git commit

## 0. 探测 openclawd 目录（首次或故障排查）

```bash
# 探测 openclaw 根目录
ls -la ~/.openclaw

# 探测会话目录与 sessions.json
ls -la ~/.openclaw/agents/main/sessions
cat ~/.openclaw/agents/main/sessions/sessions.json | head -c 500

# 可选：指定自定义路径
export OPENCLAW_HOME=~/.openclaw
```

**典型结构：**

```
~/.openclaw/
├── agents/main/sessions/
│   ├── sessions.json      # 当前会话索引
│   └── <uuid>.jsonl       # 会话消息（每行 type:message）
├── logs/
└── workspace/
```

**故障排查：** 找不到 openclawd 日志/会话时：

1. 确认 `OPENCLAW_HOME` 或 `~/.openclaw` 存在
2. 确认 `agents/main/sessions/sessions.json` 存在且含 `sessionId`
3. 确认对应 `<sessionId>.jsonl` 存在且含 `type":"message"` 行
4. 若格式变化，查看 `out/ingest_debug.json`（含 raw_tail 片段）

**Ingest 增量配置（环境变量）：**

- `OC_INGEST_MAX_FILES`（默认 3）：仅扫描最近修改的 K 个 session 文件
- `OC_INGEST_TAIL_LINES`（默认 400）：每个文件只读尾部 N 行
- `OC_INGEST_MAX_EXPAND`（默认 2）：找不到消息时最多扩展搜索 2 次
- 游标缓存：`runtime/.ingest_cursor.json`，下次优先读同一文件
- 指标输出：`out/ingest_metrics.json`（scanned_files_count、read_lines_count、ingest_runtime_ms、strategy_used）

**IR 结构化字段说明：**

- `intent_type`：plan | report | execute | fix | unknown（按关键词优先级匹配）
- `constraints`：no_external_ops、write_scope（artifacts_only | repo_only）、output_style（summary | detailed）
- `acceptance`：must_have_sections、must_include_fields、commands（至少含 npm run oc:bind、npm run review:check）

report.md 的 Risks & Safeguards、Acceptance Checks、Files to Change 由 IR 驱动。

## 1. 运行 OC pipeline

**方式 A：模拟输入（不接 openclawd）**

```bash
cd projects/oc-personal-agent-lab
npm run run:all
```

**方式 B：真实 openclawd 输入绑定**

```bash
cd projects/oc-personal-agent-lab
npm run oc:bind
```

`oc:bind` 会：ingest 最新对话 → parse → match → eval → gen:changeset，并输出 task_id/intent/top3/trace_path/report_path。

产出：

- `artifacts/<task_id>/report.md` — Executable Plan Draft（可执行计划草稿，含 Objective / Proposed Actions / Files to Change / Risks & Safeguards / Acceptance Checks）
- `out/ir.json` — 对话 IR（含 intent_type、constraints、acceptance 等结构化字段，由 parse 从用户消息中抽取）
- `out/match.json` — 匹配结果
- `out/trace.json` — 执行 trace（含 files_written、changeset_id）
- `out/changeset.json` — ChangeSet（含 pointers、git_diff_summary；git_diff_summary 仅本项目目录）

## 2. Cursor review

1. 打开 `out/changeset.json`，查看 `files_written` 和 `pointers.report_md_path`
2. 打开 `artifacts/<task_id>/report.md`（Executable Plan Draft），按需修订后由 Cursor 执行/验收
3. 运行 `npm run review:check` 确认 schema 与 changeset 字段齐全

```bash
npm run review:check
```

## 3. git commit

```bash
git add artifacts/ out/
git status
git commit -m "oc: <task_id> - <简短描述>"
```

---

## 4. /bind 自动触发（OpenClaw 对话框）

当用户消息以 `/bind` 开头时，可自动触发 oc:bind 并将 6 行摘要回显到对话框。需通过环境变量开关启用。

### 开启

```bash
# 安装插件（链接方式，便于开发）
openclaw plugins install -l /Users/qiangguo/Projects/vibe-template/projects/oc-personal-agent-lab/openclaw-bind

# 启用开关后启动 OpenClaw
OC_BIND_ENABLED=1 openclaw gateway
```

或写入 `.env`：

```
OC_BIND_ENABLED=1
```

### 关闭

不设置 `OC_BIND_ENABLED` 或设为 `0` 时，`/bind` 按普通聊天处理，不触发 pipeline。

### 验收

1. 开启开关后，在 OpenClaw 对话框发送：
   ```
   /bind test: generate report constraints: no-external-actions output: summary-only
   ```
2. 10 秒内应回显 6 行摘要（格式严格）：
   ```
   task_id: ...
   source_message_id: ...
   source_ts: ...
   top3: h1=..., h2=..., h3=...
   trace_path: ...
   report_path: ...
   ```
3. 确认 `artifacts/<task_id>/report.md` 与 `out/changeset.json` 已生成。

### 故障排查

- **不触发**：确认 `OC_BIND_ENABLED=1` 且已重启 gateway；确认插件已安装且启用（`openclaw plugins list`）。
- **bind_error: timeout**：oc:bind 超过 10 秒；检查 ingest 或 parse 是否卡住。
- **bind_error: ...**：查看 `out/ingest_debug.json` 或 OpenClaw 日志中的完整 stderr。
