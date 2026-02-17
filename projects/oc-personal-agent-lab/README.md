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

## 验收

- `out/ir.json` 通过 IR schema
- `out/match.json` 通过 pipeline schema
- `out/trace.json` 含 task_id/pipeline_name/policy_version/runtime_ms/errors
- `oc:smoke` 输出 task_id、intent、top3 hits、trace_path
