# AI 分析手工验收指南

使用真实 LLM API Key 或 `LLM_PROVIDER=fake` 验收 `/analyze_ai`、`/match_scifi_ai`（FAST）、`/match_scifi_ai_rerank`（RERANK）、`/match_scifi_ai_expand`（EXPAND）、`/match_scifi_ai_improve`（IMPROVE）。**单测不调用外网，仅本指南用于手工验证。**

## 架构说明

```
/match_scifi_ai          → FAST（1 次 LLM Generate Wide）→ candidates[] + recommended_for_ui[]
/match_scifi_ai_rerank   → RERANK（1 次 LLM Audit + 人类反馈）→ matches[]（AuditedCandidate）
/match_scifi_ai_expand   → EXPAND（1 次 LLM Generate More + 避开 reject）→ merged candidates[]
/match_scifi_ai_improve  → IMPROVE（1 次 LLM Rewrite target 条目）→ candidates[]（改写后）
```

每个端点严格 **1 次 LLM 调用**。质量问题不阻断（`success:true` + `audit.issues[]`）。

所有 rerank/expand/improve 接受可选 `feedback` 对象：

```json
{
  "keep_ids": ["id1"],
  "reject_ids": ["id2"],
  "boost_ids": ["id3"],
  "notes_by_id": { "id1": "让剧情更具体" },
  "desired_style": "more_specific"
}
```

## 环境变量

**方式一：fake 模式（无需 API Key，用于 curl 演示）**

```bash
export LLM_PROVIDER=fake
```

**方式二：真实 LLM（不要提交 key 到代码/文档）**

```bash
export LLM_API_KEY=sk-xxx
export LLM_MODEL=gpt-4o-mini
# 可选
export LLM_PROVIDER=openai
export LLM_BASE_URL=https://api.openai.com/v1
```

## 启动服务

```bash
npm run build
npm run dev
```

## 生成 viewpoint 库（生产流程）

```bash
node scripts/gen-viewpoint-library.ts --seed docs/radar_keywords.md
```

输出物：

- `docs/viewpoint_library_prompt.md`（本次生成 prompt）
- `tmp/viewpoint_raw.json`（模型原始 JSON，已 gitignore）
- `src/data/viewpointLibrary.generated.json`（落盘产物）

校验要求：脚本会自动执行字段完整性、`vp_id` 唯一、`routing_intents_cn` 与机制库对齐、`related_mechanism_ids` 合法性校验；失败即终止并输出具体 `vp_id` 与字段。

## curl 示例

### 1. POST /analyze_ai

```bash
curl -X POST http://127.0.0.1:3000/analyze_ai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer user_1" \
  -d '{"text":"某国宣布将建设月球基地，计划 2030 年前完成。专家称此举将推动航天产业链发展，但也引发太空资源争夺的担忧。"}'
```

预期：`success: true`，`data.analysis` 含 `news_points`（≥3）、`questions`（≥6）、`mechanisms`、`claims`、`search_queries`、`confidence`。

#### 验证 claims + vp_pick 结构

```bash
curl -sS -X POST http://127.0.0.1:3000/analyze_ai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer user_1" \
  -d '{"text":"医院推进自动病历助手后，医生担心训练不足会导致误判风险。"}' \
  | jq '{llm_calls:.data.pipeline.llm_calls, claim:.data.analysis.claims[0]}'
```

预期：`claim` 至少包含 `claim_id`、`claim_cn`、`evidence_quote_cn`、`vp_candidates[]`、`vp_pick{vp_id,why_pick_cn}`，并带 `vp_score_breakdown`。

#### 验证 mechanisms 命中结构

```bash
curl -sS -X POST http://127.0.0.1:3000/analyze_ai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer user_1" \
  -d '{"text":"医院计划引入自动病历助手，医生担忧训练不足会影响诊断能力。"}' \
  | tee /tmp/analyze_mech.json \
  | jq '{success, llm_calls:.data.pipeline.llm_calls, mechanisms:.data.analysis.mechanisms[0:3]}'
```

预期：`llm_calls == 1`，`mechanisms[]` 每项包含：

- `point_id`
- `mechanism_id`（M01-M30）
- `why_this_mechanism_cn`
- `evidence_quote_cn`（短片段）

### 2. FAST 验收：POST /match_scifi_ai（核心）

先执行步骤 1 获取 analysis，再组装请求：

```bash
# 1. 分析
ANALYSIS=$(curl -sS -X POST http://127.0.0.1:3000/analyze_ai \
  -H "Authorization: Bearer user_1" \
  -H "Content-Type: application/json" \
  -d '{"text":"张文宏反对把AI引入医院病历系统，因为医生需要训练专业诊断能力。"}')
echo "{\"analysis\": $(echo $ANALYSIS | jq -c '.data.analysis'), \"selected_points\": $(echo $ANALYSIS | jq -c '.data.analysis.news_points[0:2] | map(.point_cn)')}" > /tmp/match_req.json

# 2. FAST 模式调用
curl -sS -X POST http://127.0.0.1:3000/match_scifi_ai \
  -H "Authorization: Bearer user_1" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/match_req.json \
  | tee /tmp/match_res.json \
  | jq '{success, n_candidates:(.data.candidates|length), n_recommended:(.data.recommended_for_ui|length), llm_calls:.data.pipeline.llm_calls, mode:.data.pipeline.mode}'
```

**预期输出：**

```json
{
  "success": true,
  "n_candidates": 25,
  "n_recommended": 25,
  "llm_calls": 1,
  "mode": "fast"
}
```

验收标准：

- `success` = `true`
- `n_candidates` ≥ 20
- `n_recommended` ≥ 12
- `llm_calls` == 1
- `mode` == `"fast"`

### 3. RERANK 验收：POST /match_scifi_ai_rerank

从步骤 2 拿 candidates，组装 rerank 请求：

```bash
# 组装 rerank 请求体
jq '{candidates: .data.candidates, analysis: .data}' /tmp/match_req.json > /tmp/rerank_req_tmp.json
# 或手动构造：
echo "{\"candidates\": $(jq -c '.data.candidates' /tmp/match_res.json), \"analysis\": $(jq -c '.analysis' /tmp/match_req.json)}" > /tmp/rerank_req.json

# 调用 rerank
curl -sS -X POST http://127.0.0.1:3000/match_scifi_ai_rerank \
  -H "Authorization: Bearer user_1" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/rerank_req.json \
  | tee /tmp/rerank_res.json \
  | jq '{success, n_matches:(.data.matches|length), llm_calls:.data.pipeline.llm_calls, mode:.data.pipeline.mode}'
```

#### RERANK 携带 vp 信息（示例）

```bash
jq -n --argjson analysis "$(cat /tmp/analysis.json)" --argjson cands "$(cat /tmp/cands.json)" '{
  analysis: $analysis,
  candidates: $cands,
  feedback: {
    keep_ids: [$cands[0].id],
    boost_ids: [$cands[1].id]
  }
}' > /tmp/rerank_vp_req.json

curl -sS -X POST http://127.0.0.1:3000/match_scifi_ai_rerank \
  -H "Authorization: Bearer user_1" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/rerank_vp_req.json \
  | jq '{mode:.data.pipeline.mode,llm_calls:.data.pipeline.llm_calls,first:.data.matches[0]|{id,audit}}'
```

**预期输出：**

```json
{
  "success": true,
  "n_matches": 16,
  "llm_calls": 1,
  "mode": "rerank"
}
```

验收标准：

- `success` = `true`
- `n_matches` ≥ 8
- `llm_calls` == 1
- `mode` == `"rerank"`

每条 match 含 `audit.score`（5 维）+ `audit.verdict`（keep/maybe/reject）：

```bash
jq '.data.matches[0].audit' /tmp/rerank_res.json
```

### 4. EXPAND 验收：POST /match_scifi_ai_expand

```bash
echo "{\"analysis\": $(jq -c '.analysis' /tmp/match_req.json), \"selected_points\": $(jq -c '.selected_points' /tmp/match_req.json), \"existing_candidates\": $(jq -c '.data.candidates' /tmp/match_res.json)}" > /tmp/expand_req.json

curl -sS -X POST http://127.0.0.1:3000/match_scifi_ai_expand \
  -H "Authorization: Bearer user_1" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/expand_req.json \
  | jq '{success, n_candidates:(.data.candidates|length), n_recommended:(.data.recommended_for_ui|length), llm_calls:.data.pipeline.llm_calls, mode:.data.pipeline.mode}'
```

预期：`n_candidates` > 原始数量，`mode` == `"expand"`，`llm_calls` == 1。

### 5. 质量问题不阻断验证

```bash
# scene_cn 含剧情元素
jq -r '.data.candidates[].scene_cn' /tmp/match_res.json | rg -n "角色|组织|系统|事件|转折|决定|事故|审判|协议|训练|考核" \
  && echo "✅ has markers" || echo "⚠️ missing markers (but still 200)"

# mapping_cn 无拉丁字母
jq -r '.data.candidates[].mapping_cn' /tmp/match_res.json | rg -n "[A-Za-z]" && echo "⚠️ has latin (audit issue)" || echo "✅ no latin"

# 审稿问题列表
jq '.data.audit.issues | length' /tmp/match_res.json
jq '.data.audit.issues[] | {path, severity, reason}' /tmp/match_res.json
```

注意：即使有质量问题，`success` 仍为 `true`。问题记录在 `data.audit.issues[]` 中。

### 6. 稳定性回归（10 次连跑）

```bash
LLM_API_KEY=sk-xxx ./scripts/stability-regression.sh 10
```

### 7. RERANK with human feedback

从步骤 2 拿 candidates，加入人类反馈：

```bash
# 保存 analysis 和 candidates
jq -c '.data.analysis' /tmp/match_res.json > /tmp/analysis.json 2>/dev/null || jq -c '.analysis' /tmp/match_req.json > /tmp/analysis.json
jq -c '.data.candidates' /tmp/match_res.json > /tmp/cands.json

# 构造带 feedback 的 rerank 请求
jq -n --argjson analysis "$(cat /tmp/analysis.json)" --argjson cands "$(cat /tmp/cands.json)" '{
  analysis: $analysis,
  candidates: $cands,
  feedback: {
    keep_ids: [$cands[0].id],
    reject_ids: [$cands[1].id],
    boost_ids: [$cands[2].id]
  }
}' > /tmp/rerank_fb_req.json

curl -sS -X POST http://127.0.0.1:3000/match_scifi_ai_rerank \
  -H "Authorization: Bearer user_1" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/rerank_fb_req.json \
  | tee /tmp/rerank_fb_res.json \
  | jq '{success, n_matches:(.data.matches|length), llm_calls:.data.pipeline.llm_calls,
         has_kept: (.data.matches | map(.id) | contains([$cands[0].id])),
         no_rejected: (.data.matches | map(.id) | contains([$cands[1].id]) | not)}'
```

验收标准：

- `has_kept` = `true`（keep 的候选出现在结果中）
- `no_rejected` = `true`（reject 的候选不在结果中）

### 8. IMPROVE selected candidates

```bash
jq -n --argjson analysis "$(cat /tmp/analysis.json)" --argjson cands "$(cat /tmp/cands.json)" '{
  analysis: $analysis,
  candidates: $cands,
  target_ids: [$cands[0].id],
  feedback: {
    notes_by_id: {
      ($cands[0].id): "把剧情写得更具体，强调医生训练与技能退化机制"
    }
  }
}' > /tmp/improve_req.json

curl -sS -X POST http://127.0.0.1:3000/match_scifi_ai_improve \
  -H "Authorization: Bearer user_1" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/improve_req.json \
  | tee /tmp/improve_res.json \
  | jq '{success, n_candidates:(.data.candidates|length), changed_ids:.data.changed_ids, llm_calls:.data.pipeline.llm_calls, mode:.data.pipeline.mode}'
```

验收标准：

- `success` = `true`
- `changed_ids` 包含 target_ids 中的 id
- `llm_calls` == 1
- `mode` == `"improve"`
- 非 target 候选的 scene_cn/mapping_cn 保持不变

### 9. EXPAND with feedback constraints

```bash
jq -n --argjson analysis "$(cat /tmp/analysis.json)" --argjson cands "$(cat /tmp/cands.json)" '{
  analysis: $analysis,
  selected_points: ["新闻点一"],
  existing_candidates: $cands,
  feedback: {
    reject_ids: [$cands[0].id, $cands[1].id]
  }
}' > /tmp/expand_fb_req.json

curl -sS -X POST http://127.0.0.1:3000/match_scifi_ai_expand \
  -H "Authorization: Bearer user_1" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/expand_fb_req.json \
  | jq '{success, n_candidates:(.data.candidates|length), llm_calls:.data.pipeline.llm_calls, mode:.data.pipeline.mode}'
```

验收标准：`n_candidates` > 原始数量，`mode` == `"expand"`，`llm_calls` == 1。

## Studio UI 验收

1. 打开 http://127.0.0.1:3000/studio
2. 设置令牌（如 `user_1`）
3. 粘贴新闻文本，点击「AI分析」
4. 在左侧选择 1–2 条新闻点（checkbox）
5. 点击「找科幻剧情支撑」→ 立刻看到 ≥12 条候选卡片
6. 每条卡片有 👍保留/👎不要/⭐很像/✏️让它更像 四个操作按钮
7. 标记几条后，点击「根据我的选择重排/精选」→ 每条卡片显示评分 badges + verdict，reject 的不在结果中
8. 点击「补充更多但更不一样」→ 列表增加新候选（避开 reject 的作品）
9. 标记几条保留/很像后，点击「改进我选中的几条」→ 选中条目内容更新
10. 英文引用在「引用原文（点击展开）」中折叠显示

## Dev 启动端口占用处理

- 默认监听 `3000`；
- 若 `3000` 被占用且未显式设置 `PORT`，服务自动 fallback 到 `3001`；
- 启动日志会打印实际端口，例如 `server listening on http://127.0.0.1:3001`。
