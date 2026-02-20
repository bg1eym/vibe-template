# oc-personal-agent-lab

Iteration #0: 契约重置 + TS Pipeline + OC 对话入口

## 运行

```bash
cd projects/oc-personal-agent-lab
npm install
npm run gen:golden    # 生成 golden 样例（20 条）
npm run run:all       # 全流程：parse -> match -> eval -> oc:smoke
```

## 单步执行

```bash
npm run run:parse     # 解析 conversations/current.jsonl -> out/ir.json
npm run run:match     # 占位匹配 -> out/match.json, out/trace.json
npm run eval          # 校验 + 产出 out/eval_report.json
npm run oc:smoke      # 模拟 OC 输入，输出 task_id/intent/top3/trace_path
```

## 契约

- `contracts/conversation_ir.schema.json` - 对话 IR
- `contracts/pipeline_io.schema.json` - 匹配输出
- `contracts/policy.schema.json` - 策略占位

## Atlas Dashboard（oc-bind 插件）

通过自然语言或斜杠命令触发 Atlas 管道（`pnpm atlas:run`），返回看板链接 + 封面图。

### 自然语言触发（NL）

- `发我 atlas 看板`
- `生成今日 atlas`
- `atlas`
- `situation monitor`

### 斜杠命令

- `/atlas today` — 返回封面图 + 看板链接
- `/atlas help` — 帮助

### 配置（插件 config 或环境变量）

- `ATLAS_ROOT` — Atlas 仓库根目录（atlas:run 所在 repo）
- `ATLAS_DASHBOARD_URL_BASE` — 看板 URL 模板，含 `{{run_id}}`
- `ATLAS_COVER_URL_BASE` — 封面图 URL 模板，含 `{{run_id}}`

### 故障排查

1. **配置缺失**：设置 ATLAS_DASHBOARD_URL_BASE、ATLAS_COVER_URL_BASE
2. **插件未加载**：运行 `tools/fix-oc-bind-mismatch.sh`

## 验收

- `out/ir.json` 通过 IR schema
- `out/match.json` 通过 pipeline schema
- `out/trace.json` 含 task_id/pipeline_name/policy_version/runtime_ms/errors
- `oc:smoke` 输出 task_id、intent、top3 hits、trace_path
