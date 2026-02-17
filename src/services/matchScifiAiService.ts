/**
 * AI sci-fi matching service: Fast + Interactive + Non-blocking candidate system.
 * /match_scifi_ai: 1 LLM call (Generate Wide) → candidates + server-side audit
 * /match_scifi_ai_rerank: 1 LLM call (Audit/Critic) → scored matches
 * /match_scifi_ai_expand: 1 LLM call (Generate More) → merged candidates
 * Never returns success:false for quality issues. Only JSON parse / structural failures.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { LlmClient } from "../lib/llmClient.js";
import type { AnalysisResult } from "./analyzeAiService.js";
import { MECHANISM_BY_ID } from "../data/mechanismLibrary.js";
import { VIEWPOINT_BY_ID } from "../data/viewpointLibrary.js";
import { extractJsonObject } from "../lib/jsonExtract.js";
import { AppError } from "../lib/errors.js";
import { scoreClaimAgainstViewpoint } from "./viewpointScoring.js";

/* ─── Types ─── */

export type CatalogEntry = {
  title: string;
  title_cn?: string;
  author: string;
  premise: string;
  themes?: string[];
  mechanism?: string;
  hooks: string[];
};

export type CandidateSource = {
  source_id?: string;
  work_cn: string;
  author?: string;
  medium?: "novel" | "film" | "anime" | "game" | "other";
  year?: number;
};

export type MatchCandidate = {
  id: string;
  source: CandidateSource;
  scene_cn: string;
  mapping_cn: string;
  why_this_is_relevant_cn: string;
  synopsis_cn?: string;
  claim_id?: string;
  vp_id?: string;
  match_why_cn?: string;
  evidence_quote_cn?: string;
  quote_en?: string;
  confidence: number;
};

export type AuditIssue = {
  path: string;
  severity: "blocker" | "warn";
  reason: string;
  fix_instruction: string;
};

export type AuditScore = {
  relevance: number;
  specificity: number;
  mechanism_fit: number;
  novelty: number;
  human_plausibility: number;
};

export type AuditSummary = {
  pass: boolean;
  issues: AuditIssue[];
  keep_count?: number;
  maybe_count?: number;
  reject_count?: number;
  avg_relevance?: number;
  avg_total?: number;
  common_failures?: string[];
};

export type AuditedCandidate = MatchCandidate & {
  audit: {
    score: AuditScore;
    total: number;
    verdict: "keep" | "maybe" | "reject";
    reasons_cn: string[];
    fix_suggestions_cn: string[];
  };
};

export type PipelineStep = { name: string; ms: number };

export type PipelineInfo = {
  mode: "fast" | "rerank" | "expand" | "improve";
  llm_calls: number;
  steps: PipelineStep[];
};

export type HumanFeedback = {
  keep_ids?: string[];
  reject_ids?: string[];
  boost_ids?: string[];
  notes_by_id?: Record<string, string>;
  desired_style?: "more_specific" | "more_novel" | "more_mechanism" | "more_story";
};

export type MatchFastResult = {
  candidates: MatchCandidate[];
  recommended_for_ui: MatchCandidate[];
  audit: AuditSummary;
  pipeline: PipelineInfo;
};

export type RerankResult = {
  matches: AuditedCandidate[];
  audit: AuditSummary;
  pipeline: PipelineInfo;
};

export type ExpandResult = {
  candidates: MatchCandidate[];
  recommended_for_ui: MatchCandidate[];
  audit: AuditSummary;
  pipeline: PipelineInfo;
};

export type ImproveResult = {
  candidates: MatchCandidate[];
  changed_ids: string[];
  audit: AuditSummary;
  pipeline: PipelineInfo;
};

/* Legacy types for /repair endpoint backward compat */
export type AuditResult = { pass: boolean; issues: AuditIssue[] };

/* ─── Constants ─── */

const SCENE_MARKERS = /角色|组织|系统|事件|转折|决定|事故|审判|协议|训练|考核/;
const WHY_MARKERS = /因为|因此|导致|从而|机制|训练|反馈|责任|去技能化/;
const HAS_ASCII = /[a-zA-Z]/;
const MIN_LEN = 60;
const MAX_SAME_WORK = 2;
const SCORE_WEIGHTS = {
  relevance: 3,
  mechanism_fit: 2,
  specificity: 2,
  human_plausibility: 2,
  novelty: 1,
};

function findLatinSnippet(s: string, maxLen = 30): string {
  const m = s.match(/[a-zA-Z][a-zA-Z0-9\s-]*/);
  if (!m) return "";
  return m[0].slice(0, maxLen);
}

function weightedTotal(s: AuditScore): number {
  return (
    s.relevance * SCORE_WEIGHTS.relevance +
    s.mechanism_fit * SCORE_WEIGHTS.mechanism_fit +
    s.specificity * SCORE_WEIGHTS.specificity +
    s.human_plausibility * SCORE_WEIGHTS.human_plausibility +
    s.novelty * SCORE_WEIGHTS.novelty
  );
}

function clamp05(n: number): number {
  return Math.max(0, Math.min(5, Math.round(n)));
}

function mechanismNamesFromAnalysis(analysis: AnalysisResult): string[] {
  const arr = Array.isArray(analysis.mechanisms) ? analysis.mechanisms : [];
  const names = arr
    .map((m) => {
      const x = m as unknown as Record<string, unknown>;
      if (typeof x.name_cn === "string") return x.name_cn;
      if (typeof x.mechanism_id === "string")
        return MECHANISM_BY_ID.get(x.mechanism_id)?.name_cn ?? "";
      if (typeof x.id === "string") return MECHANISM_BY_ID.get(x.id)?.name_cn ?? "";
      return "";
    })
    .filter(Boolean);
  return names.length > 0 ? [...new Set(names)] : ["机制同构"];
}

/* ─── Catalog ─── */

function loadCatalog(): CatalogEntry[] {
  const path = join(process.cwd(), "data", "scifi_catalog.json");
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as CatalogEntry[];
}

function buildCatalogBlock(catalog: CatalogEntry[]): string {
  return catalog
    .slice(0, 30)
    .map(
      (e) =>
        `- ${e.title} / ${e.title_cn ?? ""} (${e.author}): premise=${e.premise}; mechanism=${e.mechanism ?? ""}; hooks=[${(e.hooks || []).join(", ")}]`,
    )
    .join("\n");
}

/* ─── Server-side quality audit (regex/length, never throws) ─── */

type QualityContext = {
  analysis: AnalysisResult;
  selectedPoints: string[];
  catalog: CatalogEntry[];
  catalogByTitle: Map<string, CatalogEntry>;
};

function collectQualityIssues(candidates: MatchCandidate[], ctx: QualityContext): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (candidates.length < 8) {
    issues.push({
      path: "candidates",
      severity: "warn",
      reason: `数量不足（期望≥8，实际${candidates.length}）`,
      fix_instruction: "增加更多匹配条目",
    });
  }

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const sid = c.source?.source_id ?? "";

    if (!sid) {
      issues.push({
        path: `candidates[${i}].source.source_id`,
        severity: "warn",
        reason: "缺少 source_id",
        fix_instruction: "添加有效的英文 source_id",
      });
    } else if (!ctx.catalogByTitle.has(sid)) {
      const examples = Array.from(ctx.catalogByTitle.keys()).slice(0, 3).join("、");
      issues.push({
        path: `candidates[${i}].source.source_id`,
        severity: "warn",
        reason: `"${sid}" 不在候选列表中（可用示例：${examples}）`,
        fix_instruction: "将 source_id 替换为候选列表中的英文 title",
      });
    }

    if (!c.source?.work_cn) {
      issues.push({
        path: `candidates[${i}].source.work_cn`,
        severity: "blocker",
        reason: "缺少 work_cn",
        fix_instruction: "添加中文作品名",
      });
    }
    if (!c.scene_cn) {
      issues.push({
        path: `candidates[${i}].scene_cn`,
        severity: "blocker",
        reason: "缺少 scene_cn",
        fix_instruction: "添加剧情节点描述（≥60字）",
      });
    }
    if (!c.mapping_cn) {
      issues.push({
        path: `candidates[${i}].mapping_cn`,
        severity: "blocker",
        reason: "缺少 mapping_cn",
        fix_instruction: "添加映射描述（≥60字）",
      });
    }
    if (!c.why_this_is_relevant_cn) {
      issues.push({
        path: `candidates[${i}].why_this_is_relevant_cn`,
        severity: "blocker",
        reason: "缺少 why_this_is_relevant_cn",
        fix_instruction: "添加同构解释（≥60字）",
      });
    }

    if (c.scene_cn && c.scene_cn.length < MIN_LEN) {
      issues.push({
        path: `candidates[${i}].scene_cn`,
        severity: "warn",
        reason: `长度不足（需≥${MIN_LEN}字，实际=${c.scene_cn.length}）："${c.scene_cn.slice(0, 30)}…"`,
        fix_instruction: `扩写到≥${MIN_LEN}字`,
      });
    }
    if (c.scene_cn && !SCENE_MARKERS.test(c.scene_cn)) {
      issues.push({
        path: `candidates[${i}].scene_cn`,
        severity: "warn",
        reason: "须含剧情元素（角色/组织/事件等）",
        fix_instruction: "加入角色、组织/系统、事件、转折、决定等标签",
      });
    }

    if (c.mapping_cn && c.mapping_cn.length < MIN_LEN) {
      issues.push({
        path: `candidates[${i}].mapping_cn`,
        severity: "warn",
        reason: `长度不足（需≥${MIN_LEN}字，实际=${c.mapping_cn.length}）："${c.mapping_cn.slice(0, 30)}…"`,
        fix_instruction: `扩写到≥${MIN_LEN}字`,
      });
    }
    if (c.mapping_cn) {
      const mechNames = mechanismNamesFromAnalysis(ctx.analysis);
      if (!mechNames.some((n) => c.mapping_cn.includes(n))) {
        const hint = mechNames.slice(0, 3).join("、");
        issues.push({
          path: `candidates[${i}].mapping_cn`,
          severity: "warn",
          reason: `须含机制名（可用：${hint}${mechNames.length > 3 ? "、..." : ""}）`,
          fix_instruction: "在 mapping_cn 中加入机制名",
        });
      }
    }

    if (c.why_this_is_relevant_cn && c.why_this_is_relevant_cn.length < MIN_LEN) {
      issues.push({
        path: `candidates[${i}].why_this_is_relevant_cn`,
        severity: "warn",
        reason: `长度不足（需≥${MIN_LEN}字，实际=${c.why_this_is_relevant_cn.length}）`,
        fix_instruction: `扩写到≥${MIN_LEN}字`,
      });
    }
    if (c.why_this_is_relevant_cn && !WHY_MARKERS.test(c.why_this_is_relevant_cn)) {
      issues.push({
        path: `candidates[${i}].why_this_is_relevant_cn`,
        severity: "warn",
        reason: "须含机制解释词（因为/因此/导致/从而/机制等）",
        fix_instruction: "添加机制同构解释",
      });
    }

    const cnFields = [
      ["scene_cn", c.scene_cn],
      ["mapping_cn", c.mapping_cn],
      ["why_this_is_relevant_cn", c.why_this_is_relevant_cn],
    ] as const;
    for (const [field, val] of cnFields) {
      if (val && HAS_ASCII.test(val)) {
        const snippet = findLatinSnippet(val);
        issues.push({
          path: `candidates[${i}].${field}`,
          severity: "warn",
          reason: `含英文字母: "${snippet ? "..." + snippet + "..." : "(detected)"}"`,
          fix_instruction: "将英文替换为中文（如 AI→人工智能）",
        });
      }
    }

    if (c.quote_en != null && c.quote_en !== "") {
      const entry = ctx.catalogByTitle.get(sid);
      const hooks = entry?.hooks || [];
      if (!hooks.some((h) => h.trim() === c.quote_en!.trim())) {
        issues.push({
          path: `candidates[${i}].quote_en`,
          severity: "warn",
          reason: "quote 可能非原文，需人工核对",
          fix_instruction: "若要严格引用，请从该作品公开文本中替换；或删除 quote_en",
        });
      }
    }
  }

  return issues;
}

/* ─── Prompt: Generate Wide ─── */

function buildGeneratePrompt(
  analysis: AnalysisResult,
  selectedPoints: string[],
  catalog: CatalogEntry[],
  count: number,
): string {
  const points =
    selectedPoints.length > 0
      ? selectedPoints
      : analysis.news_points.slice(0, 2).map((p) => p.point_cn);
  const allKeywords = analysis.news_points.flatMap((p) => p.keywords_cn || []);
  const mechNames = mechanismNamesFromAnalysis(analysis);
  const catalogBlock = buildCatalogBlock(catalog);

  return `你是一个科幻与新闻跨领域专家。请从以下候选作品列表中选择，优先使用列表中的作品。

候选作品列表：
${catalogBlock}

新闻要点：${points.join("；")}
关键词：${allKeywords.slice(0, 10).join("、")}
可用机制名：${mechNames.join("、")}

请生成 ${count} 条科幻作品与新闻的类比匹配。要求：
1. scene_cn 必须是具体剧情节点（角色/组织/事件/转折/决定），≥60字
2. mapping_cn ≥60字，含机制名
3. why_this_is_relevant_cn ≥60字
4. 中文字段禁止英文字母
5. 尽量多样化：不同作品、不同类比角度
6. source_id 用英文 title
7. quote_en 可选

输出严格 JSON：
{ "candidates": [ { "source_id": "Dune", "work_cn": "沙丘", "author": "Frank Herbert", "scene_cn": "...", "mapping_cn": "...", "why_this_is_relevant_cn": "...", "quote_en": "可选", "confidence": 0.8 } ] }
请直接输出 JSON：`;
}

/* ─── Prompt: Audit/Critic ─── */

function buildAuditPrompt(
  candidates: MatchCandidate[],
  analysis: AnalysisResult,
  feedback?: HumanFeedback,
): string {
  const mechNames = mechanismNamesFromAnalysis(analysis);
  const summary = candidates.map((c, i) => ({
    idx: i,
    id: c.id,
    work: c.source.work_cn,
    scene: c.scene_cn.slice(0, 80),
    mapping: c.mapping_cn.slice(0, 80),
  }));
  const topClaims = (analysis.claims ?? [])
    .slice(0, 3)
    .map((item) => {
      const c = item as Record<string, unknown>;
      const claimCn = String(c.claim_cn ?? "");
      const vpPick = (c.vp_pick as Record<string, unknown> | undefined) ?? {};
      const vpId = String(vpPick.vp_id ?? "");
      const vp = VIEWPOINT_BY_ID.get(vpId);
      const scored = scoreClaimAgainstViewpoint(claimCn, vp ? [vp] : [], analysis.mechanisms).at(0);
      return {
        claim_id: String(c.claim_id ?? ""),
        claim_cn: claimCn,
        evidence_quote_cn: String(c.evidence_quote_cn ?? ""),
        vp_pick: vpId,
        vp_name_cn: vp?.name_cn ?? "",
        vp_definition_cn: vp?.definition_cn ?? "",
        vp_score_breakdown: scored ?? {
          vp_id: vpId,
          keyword_hit: 0,
          question_hit: 0,
          mechanism_overlap: 0,
          total: 0,
        },
      };
    })
    .filter((x) => x.claim_cn);

  let feedbackBlock = "";
  if (feedback) {
    const parts: string[] = [];
    if (feedback.keep_ids?.length)
      parts.push(
        `用户明确保留的候选 id：${feedback.keep_ids.join("、")}——请给予更高评价并解释其优点`,
      );
    if (feedback.reject_ids?.length)
      parts.push(
        `用户明确淘汰的候选 id：${feedback.reject_ids.join("、")}——默认 verdict=reject，除非你能说明"为何用户可能误杀"`,
      );
    if (feedback.boost_ids?.length)
      parts.push(
        `用户特别看好的候选 id：${feedback.boost_ids.join("、")}——给予更具体的解释和更高权重`,
      );
    if (feedback.desired_style)
      parts.push(`用户偏好风格：${feedback.desired_style}——评分时参考此偏好`);
    feedbackBlock = `\n人类反馈：\n${parts.join("\n")}\n`;
  }

  return `你是一位严格的播客节目制作人。请对以下科幻-新闻类比候选逐条评分。
${feedbackBlock}
可用机制名：${mechNames.join("、")}
Top claims + viewpoint 依据：
${JSON.stringify(topClaims, null, 2)}

评分维度（0-5分）：
- relevance（类比同构程度）
- specificity（是否具体到角色/组织/事件/转折）
- mechanism_fit（机制是否驱动类比）
- novelty（不是万能套模板）
- human_plausibility（人类听起来是否成立）

verdict 规则：keep（总分≥35）、maybe（20-34）、reject（<20）

候选列表：
${JSON.stringify(summary, null, 2)}

输出严格 JSON：
{ "audited": [ { "id": "候选id", "score": { "relevance": 4, "specificity": 3, "mechanism_fit": 4, "novelty": 3, "human_plausibility": 4 }, "verdict": "keep", "reasons_cn": ["..."], "fix_suggestions_cn": ["..."] } ] }
请直接输出 JSON：`;
}

/* ─── Prompt: Expand ─── */

function buildExpandPrompt(
  analysis: AnalysisResult,
  selectedPoints: string[],
  catalog: CatalogEntry[],
  existingWorks: string[],
  count: number,
  feedback?: HumanFeedback,
): string {
  const points =
    selectedPoints.length > 0
      ? selectedPoints
      : analysis.news_points.slice(0, 2).map((p) => p.point_cn);
  const allKeywords = analysis.news_points.flatMap((p) => p.keywords_cn || []);
  const mechNames = mechanismNamesFromAnalysis(analysis);
  const catalogBlock = buildCatalogBlock(catalog);

  let feedbackBlock = "";
  if (feedback) {
    const parts: string[] = [];
    if (feedback.reject_ids?.length) parts.push(`用户不喜欢的候选母题/作品，请避开类似风格和主题`);
    if (feedback.keep_ids?.length || feedback.boost_ids?.length)
      parts.push(
        `用户喜欢的类型偏好：请参考被保留/看好的候选的机制和类比角度，往类似方向但不同作品探索`,
      );
    if (feedback.desired_style) parts.push(`用户偏好风格：${feedback.desired_style}`);
    feedbackBlock = `\n人类反馈约束：\n${parts.join("\n")}\n`;
  }

  return `你是一个科幻与新闻跨领域专家。请补充 ${count} 条新的高质量匹配。

已有作品（避免重复）：${existingWorks.join("、")}
${feedbackBlock}
候选作品列表：
${catalogBlock}

新闻要点：${points.join("；")}
关键词：${allKeywords.slice(0, 10).join("、")}
可用机制名：${mechNames.join("、")}

要求：使用不同于已有作品的作品，scene_cn≥60字具体剧情节点，mapping_cn≥60字含机制名，中文字段禁英文字母。

输出严格 JSON：
{ "candidates": [ { "source_id": "...", "work_cn": "...", "author": "...", "scene_cn": "...", "mapping_cn": "...", "why_this_is_relevant_cn": "...", "quote_en": "可选", "confidence": 0.8 } ] }
请直接输出 JSON：`;
}

/* ─── Parse: LLM flat output → MatchCandidate[] ─── */

function parseCandidates(raw: unknown): MatchCandidate[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const arr = Array.isArray(o.candidates)
    ? o.candidates
    : Array.isArray(o.matches)
      ? o.matches
      : [];
  const result: MatchCandidate[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const sourceObj = c.source as Record<string, unknown> | undefined;
    result.push({
      id: typeof c.id === "string" ? c.id : randomUUID(),
      source: {
        source_id:
          typeof sourceObj?.source_id === "string"
            ? sourceObj.source_id
            : typeof c.source_id === "string"
              ? c.source_id
              : undefined,
        work_cn:
          typeof sourceObj?.work_cn === "string"
            ? sourceObj.work_cn
            : typeof c.work_cn === "string"
              ? c.work_cn
              : "",
        author:
          typeof sourceObj?.author === "string"
            ? sourceObj.author
            : typeof c.author === "string"
              ? c.author
              : undefined,
        medium: undefined,
        year: undefined,
      },
      scene_cn: typeof c.scene_cn === "string" ? c.scene_cn : "",
      mapping_cn: typeof c.mapping_cn === "string" ? c.mapping_cn : "",
      why_this_is_relevant_cn:
        typeof c.why_this_is_relevant_cn === "string" ? c.why_this_is_relevant_cn : "",
      synopsis_cn: typeof c.synopsis_cn === "string" ? c.synopsis_cn : undefined,
      claim_id: typeof c.claim_id === "string" ? c.claim_id : undefined,
      vp_id: typeof c.vp_id === "string" ? c.vp_id : undefined,
      match_why_cn: typeof c.match_why_cn === "string" ? c.match_why_cn : undefined,
      evidence_quote_cn: typeof c.evidence_quote_cn === "string" ? c.evidence_quote_cn : undefined,
      quote_en: c.quote_en != null && c.quote_en !== "" ? String(c.quote_en) : undefined,
      confidence: typeof c.confidence === "number" ? c.confidence : 0,
    });
  }
  return result;
}

/* ─── Recommend for UI: sort by simple quality heuristic, take top N ─── */

function recommendForUi(candidates: MatchCandidate[], n: number): MatchCandidate[] {
  const scored = candidates.map((c) => {
    let s = 0;
    if (c.source?.source_id) s += 2;
    if (c.scene_cn.length >= MIN_LEN) s += 1;
    if (c.mapping_cn.length >= MIN_LEN) s += 1;
    if (c.why_this_is_relevant_cn.length >= MIN_LEN) s += 1;
    if (SCENE_MARKERS.test(c.scene_cn)) s += 1;
    if (!HAS_ASCII.test(c.scene_cn + c.mapping_cn + c.why_this_is_relevant_cn)) s += 1;
    s += c.confidence;
    return { c, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, Math.max(n, candidates.length)).map((x) => x.c);
}

/* ═══ A. POST /match_scifi_ai — FAST mode (1 LLM call) ═══ */

export async function matchScifiAi(
  analysis: AnalysisResult,
  selectedPoints: string[],
  llm: LlmClient,
): Promise<MatchFastResult> {
  const catalog = loadCatalog();
  const catalogByTitle = new Map(catalog.map((e) => [e.title, e]));
  const steps: PipelineStep[] = [];

  const t0 = Date.now();
  const prompt = buildGeneratePrompt(analysis, selectedPoints, catalog, 25);
  const response = await llm.complete([{ role: "user", content: prompt }]);
  steps.push({ name: "generate", ms: Date.now() - t0 });

  const extracted = extractJsonObject(response);
  if (!extracted.ok) {
    throw new AppError("BAD_UPSTREAM", 503, `LLM 输出解析失败：${extracted.reason}`);
  }
  const candidates = parseCandidates(extracted.value);
  if (candidates.length === 0) {
    throw new AppError("BAD_UPSTREAM", 503, "LLM 输出不符合约定：缺少 candidates/matches 数组");
  }

  const t1 = Date.now();
  const ctx: QualityContext = { analysis, selectedPoints, catalog, catalogByTitle };
  const issues = collectQualityIssues(candidates, ctx);
  steps.push({ name: "quality_check", ms: Date.now() - t1 });

  const pass = issues.every((i) => i.severity !== "blocker");
  const recommended = recommendForUi(candidates, 12);

  return {
    candidates,
    recommended_for_ui: recommended,
    audit: { pass, issues },
    pipeline: { mode: "fast", llm_calls: 1, steps },
  };
}

/* ═══ B. POST /match_scifi_ai_rerank — 1 LLM audit call ═══ */

export async function rerankMatchScifiAi(
  candidates: MatchCandidate[],
  analysis: AnalysisResult,
  llm: LlmClient,
  feedback?: HumanFeedback,
): Promise<RerankResult> {
  const catalog = loadCatalog();
  const catalogByTitle = new Map(catalog.map((e) => [e.title, e]));
  const steps: PipelineStep[] = [];

  const t0 = Date.now();
  const prompt = buildAuditPrompt(candidates, analysis, feedback);
  const response = await llm.complete([{ role: "user", content: prompt }]);
  steps.push({ name: "audit", ms: Date.now() - t0 });

  const extracted = extractJsonObject(response);
  const auditMap = new Map<
    string,
    { score: AuditScore; verdict: string; reasons_cn: string[]; fix_suggestions_cn: string[] }
  >();
  if (extracted.ok) {
    const o = extracted.value as Record<string, unknown>;
    const arr = Array.isArray(o.audited) ? o.audited : [];
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i] as Record<string, unknown> | undefined;
      if (!a) continue;
      const id = typeof a.id === "string" ? a.id : (candidates[i]?.id ?? "");
      const s = (a.score as Record<string, unknown>) || {};
      auditMap.set(id, {
        score: {
          relevance: clamp05(Number(s.relevance) || 0),
          specificity: clamp05(Number(s.specificity) || 0),
          mechanism_fit: clamp05(Number(s.mechanism_fit) || 0),
          novelty: clamp05(Number(s.novelty) || 0),
          human_plausibility: clamp05(Number(s.human_plausibility) || 0),
        },
        verdict: typeof a.verdict === "string" ? a.verdict : "maybe",
        reasons_cn: Array.isArray(a.reasons_cn) ? a.reasons_cn.map(String).slice(0, 3) : [],
        fix_suggestions_cn: Array.isArray(a.fix_suggestions_cn)
          ? a.fix_suggestions_cn.map(String).slice(0, 3)
          : [],
      });
    }
  }

  const audited: AuditedCandidate[] = candidates.map((c) => {
    const a = auditMap.get(c.id);
    const score: AuditScore = a?.score ?? {
      relevance: 3,
      specificity: 3,
      mechanism_fit: 3,
      novelty: 3,
      human_plausibility: 3,
    };
    return {
      ...c,
      audit: {
        score,
        total: weightedTotal(score),
        verdict: (a?.verdict ?? "maybe") as "keep" | "maybe" | "reject",
        reasons_cn: a?.reasons_cn ?? [],
        fix_suggestions_cn: a?.fix_suggestions_cn ?? [],
      },
    };
  });

  // Curate: respect feedback, sort by total, diversity constraint
  const rejectSet = new Set(feedback?.reject_ids ?? []);
  const keepSet = new Set(feedback?.keep_ids ?? []);
  const boostSet = new Set(feedback?.boost_ids ?? []);

  // Apply feedback overrides
  for (const c of audited) {
    if (rejectSet.has(c.id)) {
      c.audit.verdict = "reject";
    }
    if (boostSet.has(c.id)) {
      c.audit.total += 8;
    }
  }

  const sorted = [...audited].sort((a, b) => b.audit.total - a.audit.total);

  // Phase 1: kept items go first (max half of 16 = 8)
  const selected: AuditedCandidate[] = [];
  const workCount = new Map<string, number>();
  const addToSelected = (c: AuditedCandidate) => {
    const wk = c.source.work_cn || c.source.source_id || "";
    workCount.set(wk, (workCount.get(wk) || 0) + 1);
    selected.push(c);
  };

  for (const c of sorted) {
    if (selected.length >= 8) break;
    if (keepSet.has(c.id) && !rejectSet.has(c.id)) {
      addToSelected(c);
    }
  }

  // Phase 2: fill remaining with diversity constraint, skip rejected
  for (const c of sorted) {
    if (selected.length >= 16) break;
    if (selected.includes(c)) continue;
    if (rejectSet.has(c.id)) continue;
    const wk = c.source.work_cn || c.source.source_id || "";
    const cnt = workCount.get(wk) || 0;
    if (cnt >= MAX_SAME_WORK && !keepSet.has(c.id)) continue;
    addToSelected(c);
  }
  // Phase 3: if still short, fill without diversity constraint (skip rejected)
  if (selected.length < Math.min(16, sorted.length)) {
    for (const c of sorted) {
      if (selected.length >= 16) break;
      if (selected.includes(c)) continue;
      if (rejectSet.has(c.id)) continue;
      addToSelected(c);
    }
  }

  const ctx: QualityContext = {
    analysis,
    selectedPoints: [],
    catalog,
    catalogByTitle,
  };
  const issues = collectQualityIssues(selected, ctx);
  const keepCount = selected.filter((c) => c.audit.verdict === "keep").length;
  const maybeCount = selected.filter((c) => c.audit.verdict === "maybe").length;
  const rejectCount = selected.filter((c) => c.audit.verdict === "reject").length;
  const avgRel =
    selected.length > 0
      ? Math.round(
          (selected.reduce((s, c) => s + c.audit.score.relevance, 0) / selected.length) * 10,
        ) / 10
      : 0;
  const avgTotal =
    selected.length > 0
      ? Math.round((selected.reduce((s, c) => s + c.audit.total, 0) / selected.length) * 10) / 10
      : 0;

  return {
    matches: selected,
    audit: {
      pass: issues.every((i) => i.severity !== "blocker") && keepCount >= 1,
      issues,
      keep_count: keepCount,
      maybe_count: maybeCount,
      reject_count: rejectCount,
      avg_relevance: avgRel,
      avg_total: avgTotal,
    },
    pipeline: { mode: "rerank", llm_calls: 1, steps },
  };
}

/* ═══ C. POST /match_scifi_ai_expand — 1 LLM call ═══ */

export async function expandMatchScifiAi(
  analysis: AnalysisResult,
  selectedPoints: string[],
  existingCandidates: MatchCandidate[],
  llm: LlmClient,
  feedback?: HumanFeedback,
): Promise<ExpandResult> {
  const catalog = loadCatalog();
  const catalogByTitle = new Map(catalog.map((e) => [e.title, e]));
  // Also exclude works from rejected candidates
  const rejectSet = new Set(feedback?.reject_ids ?? []);
  const rejectedWorks = existingCandidates
    .filter((c) => rejectSet.has(c.id))
    .map((c) => c.source.work_cn)
    .filter(Boolean);
  const existingWorks = [
    ...new Set([
      ...existingCandidates.map((c) => c.source.work_cn).filter(Boolean),
      ...rejectedWorks,
    ]),
  ];
  const steps: PipelineStep[] = [];

  const t0 = Date.now();
  const prompt = buildExpandPrompt(analysis, selectedPoints, catalog, existingWorks, 15, feedback);
  const response = await llm.complete([{ role: "user", content: prompt }]);
  steps.push({ name: "expand", ms: Date.now() - t0 });

  const extracted = extractJsonObject(response);
  let newCandidates: MatchCandidate[] = [];
  if (extracted.ok) {
    newCandidates = parseCandidates(extracted.value);
  }

  const merged = [...existingCandidates, ...newCandidates];
  const ctx: QualityContext = { analysis, selectedPoints, catalog, catalogByTitle };
  const issues = collectQualityIssues(merged, ctx);
  const recommended = recommendForUi(merged, 12);

  return {
    candidates: merged,
    recommended_for_ui: recommended,
    audit: { pass: issues.every((i) => i.severity !== "blocker"), issues },
    pipeline: { mode: "expand", llm_calls: 1, steps },
  };
}

/* ═══ D. POST /match_scifi_ai_improve — 1 LLM call, rewrite target items ═══ */

function buildImprovePrompt(
  targets: MatchCandidate[],
  selectedPoints: string[],
  analysis: AnalysisResult,
  feedback?: HumanFeedback,
): string {
  const mechNames = mechanismNamesFromAnalysis(analysis);
  const points =
    selectedPoints.length > 0
      ? selectedPoints
      : analysis.news_points.slice(0, 2).map((p) => p.point_cn);
  const notesBlock = targets
    .map((t) => {
      const note = feedback?.notes_by_id?.[t.id] ?? "";
      return `- id="${t.id}" (${t.source.work_cn}): ${note || "请让描述更具体、更有剧情感"}`;
    })
    .join("\n");

  const styleHint =
    feedback?.desired_style === "more_specific"
      ? "请让剧情和映射更具体到角色名、事件细节"
      : feedback?.desired_style === "more_novel"
        ? "请换一个更新颖的类比角度"
        : feedback?.desired_style === "more_mechanism"
          ? "请更深入地解释机制同构"
          : feedback?.desired_style === "more_story"
            ? "请让场景描述更像一个具体的故事段落"
            : "请让描述更具体和有说服力";

  return `你是一个科幻文学与新闻分析专家。请改写以下候选条目，使它们更好。

改写目标：
${notesBlock}

新闻要点：
${points.join("；")}

改写指导：${styleHint}

可用机制名：${mechNames.join("、")}

规则：
- 只改写 scene_cn、mapping_cn、why_this_is_relevant_cn
- 保持 id、source_id、work_cn、author、quote_en 不变
- scene_cn≥60字具体剧情节点，mapping_cn≥60字含机制名
- 中文字段禁止英文字母

待改写条目：
${JSON.stringify(
  targets.map((t) => ({
    id: t.id,
    source_id: t.source.source_id,
    work_cn: t.source.work_cn,
    author: t.source.author,
    scene_cn: t.scene_cn,
    mapping_cn: t.mapping_cn,
    why_this_is_relevant_cn: t.why_this_is_relevant_cn,
    quote_en: t.quote_en,
  })),
  null,
  2,
)}

输出严格 JSON：
{ "candidates": [ { "id": "原id", "source_id": "不变", "work_cn": "不变", "author": "不变", "scene_cn": "改写后", "mapping_cn": "改写后", "why_this_is_relevant_cn": "改写后", "quote_en": "不变", "confidence": 0.9 } ] }
请直接输出 JSON：`;
}

export async function improveMatchScifiAi(
  allCandidates: MatchCandidate[],
  targetIds: string[],
  selectedPoints: string[],
  analysis: AnalysisResult,
  llm: LlmClient,
  feedback?: HumanFeedback,
): Promise<ImproveResult> {
  const catalog = loadCatalog();
  const catalogByTitle = new Map(catalog.map((e) => [e.title, e]));
  const steps: PipelineStep[] = [];

  const targetSet = new Set(targetIds);
  const targets = allCandidates.filter((c) => targetSet.has(c.id));
  if (targets.length === 0) {
    const ctx: QualityContext = {
      analysis,
      selectedPoints,
      catalog,
      catalogByTitle,
    };
    const issues = collectQualityIssues(allCandidates, ctx);
    return {
      candidates: allCandidates,
      changed_ids: [],
      audit: { pass: issues.every((i) => i.severity !== "blocker"), issues },
      pipeline: { mode: "improve", llm_calls: 0, steps },
    };
  }

  const t0 = Date.now();
  const prompt = buildImprovePrompt(targets, selectedPoints, analysis, feedback);
  const response = await llm.complete([{ role: "user", content: prompt }]);
  steps.push({ name: "improve", ms: Date.now() - t0 });

  const extracted = extractJsonObject(response);
  const improvedMap = new Map<string, MatchCandidate>();
  if (extracted.ok) {
    const parsed = parseCandidates(extracted.value);
    for (const c of parsed) {
      if (c.id && targetSet.has(c.id)) {
        improvedMap.set(c.id, c);
      }
    }
  }

  // Merge: replace targets with improved versions, keep others unchanged
  const merged = allCandidates.map((c) => {
    const improved = improvedMap.get(c.id);
    if (!improved) return c;
    return {
      ...c,
      scene_cn: improved.scene_cn || c.scene_cn,
      mapping_cn: improved.mapping_cn || c.mapping_cn,
      why_this_is_relevant_cn: improved.why_this_is_relevant_cn || c.why_this_is_relevant_cn,
    };
  });

  const ctx: QualityContext = { analysis, selectedPoints, catalog, catalogByTitle };
  const issues = collectQualityIssues(merged, ctx);

  return {
    candidates: merged,
    changed_ids: [...improvedMap.keys()],
    audit: { pass: issues.every((i) => i.severity !== "blocker"), issues },
    pipeline: { mode: "improve", llm_calls: 1, steps },
  };
}

/* ═══ Legacy: POST /repair_match_scifi_ai ═══ */

export async function repairMatchScifiAi(
  draft: { matches: unknown[] },
  issues: AuditIssue[],
  analysis: AnalysisResult,
  llm: LlmClient,
): Promise<{ matches: MatchCandidate[]; audit: AuditResult }> {
  const catalog = loadCatalog();
  const catalogByTitle = new Map(catalog.map((e) => [e.title, e]));
  const mechNames = mechanismNamesFromAnalysis(analysis);
  const catalogBlock = buildCatalogBlock(catalog);
  const issueList = issues.map((i) => `- ${i.path}: ${i.reason} → ${i.fix_instruction}`).join("\n");

  const prompt = `【定向修补】以下 JSON 存在质量问题，请按指示修复：

问题清单：
${issueList}

修复规则：
- 只修改问题指向的字段
- source_id 使用候选列表中的英文 title
- 中文字段禁止拉丁字母
- quote_en 可选

候选作品列表：
${catalogBlock}

可用机制名：${mechNames.join("、")}

输入：
${JSON.stringify(draft, null, 2)}

请直接输出修复后的完整 JSON（含 matches）：`;

  const response = await llm.complete([{ role: "user", content: prompt }]);
  const extracted = extractJsonObject(response);
  if (!extracted.ok) {
    throw new AppError("BAD_UPSTREAM", 503, `Repair 输出解析失败：${extracted.reason}`);
  }
  const repaired = parseCandidates(extracted.value);
  const ctx: QualityContext = { analysis, selectedPoints: [], catalog, catalogByTitle };
  const auditIssues = collectQualityIssues(repaired, ctx);

  return {
    matches: repaired,
    audit: { pass: auditIssues.every((i) => i.severity !== "blocker"), issues: auditIssues },
  };
}
