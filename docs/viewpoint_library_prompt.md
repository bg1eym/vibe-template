# Viewpoint Library Prompt

```
你是观点库构建助手。基于给定关键词生成至少200条观点库条目，输出严格 JSON。

seed:
# Radar Keywords

- AI 医疗
- 医生训练
- 技能退化
- 平台治理
- 监管滞后
- 指标异化
- 风险外部化
- 供应链瓶颈
- 能源转型
- 公共安全
- 舆情传播
- 跨境合规


机制可用 id:
M01,M02,M03,M04,M05,M06,M07,M08,M09,M10,M11,M12,M13,M14,M15,M16,M17,M18,M19,M20,M21,M22,M23,M24,M25,M26,M27,M28,M29,M30

输出格式:
{
  "viewpoints": [
    {
      "vp_id": "VP001",
      "name_cn": "观点名",
      "definition_cn": "定义",
      "diagnostic_questions_cn": ["q1","q2","q3"],
      "evidence_patterns": ["词1","词2","词3","词4","词5"],
      "routing_intents_cn": ["意图A","意图B"],
      "related_mechanism_ids": ["M01","M10"],
      "examples": ["例子1","例子2"]
    }
  ]
}

仅返回 JSON。
```
