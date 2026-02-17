import { MECHANISM_BY_ID, MECHANISM_LIBRARY } from "./mechanismLibrary.js";

export type ViewpointPick = {
  vp_id: string;
  why_pick_cn: string;
};

export type ViewpointClaim = {
  claim_id: string;
  claim_cn: string;
  evidence_quote_cn: string;
  vp_candidates: string[];
  vp_pick: ViewpointPick;
  vp_score_breakdown?: {
    keyword_hit: number;
    question_hit: number;
    mechanism_overlap: number;
    total: number;
  };
};

export type ViewpointEntry = {
  vp_id: string;
  name_cn: string;
  definition_cn: string;
  diagnostic_questions_cn: string[];
  evidence_patterns: string[];
  routing_intents_cn: string[];
  related_mechanism_ids: string[];
  examples: string[];
};

const ALLOWED_ROUTING_INTENTS = Array.from(
  new Set(MECHANISM_LIBRARY.flatMap((m) => m.routing_intents_cn)),
);

const THEMES = [
  "医疗自动化",
  "教育训练",
  "平台治理",
  "公共安全",
  "金融风控",
  "舆情传播",
  "供应链韧性",
  "城市治理",
  "数据合规",
  "能源转型",
  "航天探索",
  "基层执行",
  "应急响应",
  "产业升级",
  "组织协同",
  "智能制造",
  "生态保护",
  "跨境贸易",
  "社会保障",
  "就业结构",
];

const PATTERN_BANK = [
  "效率",
  "风险",
  "瓶颈",
  "失灵",
  "外包",
  "训练不足",
  "指标",
  "反馈",
  "延迟",
  "误判",
  "协同",
  "断点",
  "信任",
  "透明",
  "问责",
  "失衡",
  "替代",
  "依赖",
  "冗余",
  "熔断",
];

function pickMechanismIds(idx: number): string[] {
  const keys = Array.from(MECHANISM_BY_ID.keys());
  const a = keys[idx % keys.length];
  const b = keys[(idx + 7) % keys.length];
  return a === b ? [a] : [a, b];
}

function buildEntry(idx: number, theme: string, variant: number): ViewpointEntry {
  const vpId = `VP${String(idx + 1).padStart(3, "0")}`;
  const related = pickMechanismIds(idx);
  const routing = [
    ALLOWED_ROUTING_INTENTS[idx % ALLOWED_ROUTING_INTENTS.length],
    ALLOWED_ROUTING_INTENTS[(idx + 3) % ALLOWED_ROUTING_INTENTS.length],
  ];
  const p0 = PATTERN_BANK[(idx + variant) % PATTERN_BANK.length];
  const p1 = PATTERN_BANK[(idx + variant + 2) % PATTERN_BANK.length];
  const p2 = PATTERN_BANK[(idx + variant + 4) % PATTERN_BANK.length];
  const p3 = PATTERN_BANK[(idx + variant + 6) % PATTERN_BANK.length];
  const p4 = PATTERN_BANK[(idx + variant + 8) % PATTERN_BANK.length];
  return {
    vp_id: vpId,
    name_cn: `${theme}观点${variant + 1}`,
    definition_cn: `${theme}在系统扩张中容易出现${p0}与${p1}并存的问题，治理重点在于降低脆弱点并维持可解释反馈。`,
    diagnostic_questions_cn: [
      `${theme}是否存在明显的${p0}信号？`,
      `当前流程是否因${p1}导致决策延误？`,
      `是否出现${p2}引发的连锁反应？`,
    ],
    evidence_patterns: [`${theme}`, p0, p1, p2, p3, p4],
    routing_intents_cn: routing,
    related_mechanism_ids: related,
    examples: [
      `${theme}场景下，某地在推进新系统时因为${p0}造成服务波动。`,
      `${theme}报道中提到一线执行受${p1}影响，最终放大了治理成本。`,
    ],
  };
}

function buildLibrary(): ViewpointEntry[] {
  const result: ViewpointEntry[] = [];
  let idx = 0;
  for (const theme of THEMES) {
    for (let v = 0; v < 10; v++) {
      result.push(buildEntry(idx, theme, v));
      idx++;
    }
  }
  return result;
}

export const VIEWPOINT_LIBRARY: ViewpointEntry[] = buildLibrary();
export const VIEWPOINT_BY_ID = new Map(VIEWPOINT_LIBRARY.map((x) => [x.vp_id, x] as const));

export function validateViewpointLibrary(items: ViewpointEntry[]): string[] {
  const errs: string[] = [];
  const idSeen = new Set<string>();
  for (const it of items) {
    if (!it.vp_id) errs.push("[unknown] missing vp_id");
    else if (idSeen.has(it.vp_id)) errs.push(`[${it.vp_id}] duplicate vp_id`);
    else idSeen.add(it.vp_id);

    const id = it.vp_id || "unknown";
    if (!it.name_cn) errs.push(`[${id}] name_cn is empty`);
    if (!it.definition_cn) errs.push(`[${id}] definition_cn is empty`);
    if (!Array.isArray(it.diagnostic_questions_cn) || it.diagnostic_questions_cn.length < 3)
      errs.push(`[${id}] diagnostic_questions_cn must have >= 3`);
    if (!Array.isArray(it.evidence_patterns) || it.evidence_patterns.length < 5)
      errs.push(`[${id}] evidence_patterns must have >= 5`);
    if (!Array.isArray(it.routing_intents_cn) || it.routing_intents_cn.length < 2) {
      errs.push(`[${id}] routing_intents_cn must have >= 2`);
    } else {
      for (const r of it.routing_intents_cn) {
        if (!ALLOWED_ROUTING_INTENTS.includes(r)) {
          errs.push(`[${id}] invalid routing_intent: ${r}`);
        }
      }
    }
    if (!Array.isArray(it.related_mechanism_ids) || it.related_mechanism_ids.length < 1) {
      errs.push(`[${id}] related_mechanism_ids must not be empty`);
    } else {
      for (const mid of it.related_mechanism_ids) {
        if (!MECHANISM_BY_ID.has(mid)) {
          errs.push(`[${id}] invalid mechanism_id: ${mid}`);
        }
      }
    }
    if (!Array.isArray(it.examples) || it.examples.length < 2) {
      errs.push(`[${id}] examples must have >= 2`);
    }
  }
  return errs;
}
