/**
 * AI analysis service: LLM-based news analysis.
 * Output: news_points, mechanisms, claims, questions, search_queries, confidence.
 */
import type { LlmClient } from "../lib/llmClient.js";
import { extractJsonObject } from "../lib/jsonExtract.js";
import { AppError } from "../lib/errors.js";
import {
  VIEWPOINT_BY_ID,
  VIEWPOINT_LIBRARY,
  type ViewpointClaim,
} from "../data/viewpointLibrary.js";
import { deriveEvidenceQuote, scoreClaimAgainstViewpoint } from "./viewpointScoring.js";
import { MECHANISM_BY_ID } from "../data/mechanismLibrary.js";

export type NewsPoint = {
  point_cn: string;
  evidence_cn: string;
  keywords_cn: string[];
};

export type MechanismHit = {
  point_id: number;
  mechanism_id: string;
  why_this_mechanism_cn: string;
  evidence_quote_cn: string;
};

export type AnalysisResult = {
  news_points: NewsPoint[];
  mechanisms: MechanismHit[];
  claims: ViewpointClaim[];
  questions: string[];
  search_queries: string[];
  confidence: number;
};

const ANALYSIS_PROMPT = `你是一个新闻分析专家。分析以下新闻文本，输出严格 JSON，不要夹杂任何自然语言说明。
输出格式（必须严格遵守）：
{
  "news_points": [
    { "point_cn": "新闻要点（中文）", "evidence_cn": "支撑证据", "keywords_cn": ["关键词1", "关键词2"] }
  ],
  "mechanisms": [
    { "point_id": 0, "mechanism_id": "M10", "why_this_mechanism_cn": "为何命中该机制", "evidence_quote_cn": "新闻原文片段" }
  ],
  "claims": [
    {
      "claim_id": "c1",
      "claim_cn": "主张",
      "evidence_quote_cn": "证据摘句",
      "vp_candidates": ["VP001", "VP002", "VP003"],
      "vp_pick": { "vp_id": "VP001", "why_pick_cn": "为何选它" }
    }
  ],
  "questions": ["问题1", "问题2", ...],
  "search_queries": ["搜索词1", "搜索词2", ...],
  "confidence": 0.0
}
要求：news_points 至少 3 条；questions 至少 6 条；全中文为主；confidence 为 0-1 浮点数。
mechanisms 可为空数组；若非空，mechanism_id 必须来自以下列表：
M01,M02,M03,M04,M05,M06,M07,M08,M09,M10,M11,M12,M13,M14,M15,M16,M17,M18,M19,M20,M21,M22,M23,M24,M25,M26,M27,M28,M29,M30
claims 至少 3 条。vp_candidates 必须是 VP001-VP200 中的 id。
新闻文本：
`;

const RETRY_PROMPT_PREFIX = `【重要】只输出一个 JSON 对象，不要任何解释、不要代码块标记、不要 markdown。必须包含 news_points（数组≥3）、questions（数组≥6）、confidence（0-1）。\n\n`;

function validateNewsPoint(p: unknown): p is NewsPoint {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.point_cn === "string" &&
    Array.isArray(o.keywords_cn) &&
    o.keywords_cn.every((k: unknown) => typeof k === "string")
  );
}

function validateAnalysis(parsed: unknown): AnalysisResult {
  if (!parsed || typeof parsed !== "object") {
    throw new AppError("BAD_UPSTREAM", 503, "LLM 输出不符合约定：非对象");
  }
  const o = parsed as Record<string, unknown>;

  const news_points = Array.isArray(o.news_points) ? o.news_points : [];
  if (news_points.length < 3) {
    throw new AppError(
      "BAD_UPSTREAM",
      503,
      `LLM 输出不符合约定：news_points 数量不足（需≥3，实际${news_points.length}）`,
    );
  }
  for (let i = 0; i < news_points.length; i++) {
    if (!validateNewsPoint(news_points[i])) {
      throw new AppError(
        "BAD_UPSTREAM",
        503,
        `LLM 输出不符合约定：news_points[${i}] 缺少 point_cn 或 keywords_cn`,
      );
    }
  }

  const questions = Array.isArray(o.questions) ? o.questions : [];
  if (questions.length < 6) {
    throw new AppError(
      "BAD_UPSTREAM",
      503,
      `LLM 输出不符合约定：questions 数量不足（需≥6，实际${questions.length}）`,
    );
  }

  const confidence = Number(o.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new AppError("BAD_UPSTREAM", 503, "LLM 输出不符合约定：confidence 须为 0-1 浮点数");
  }

  const mechanismsRaw = Array.isArray(o.mechanisms) ? o.mechanisms : [];
  const claimsRaw = Array.isArray(o.claims) ? o.claims : [];
  const search_queries = Array.isArray(o.search_queries) ? o.search_queries : [];

  const mechanisms: MechanismHit[] = mechanismsRaw
    .map((m, idx) => {
      const x = (m ?? {}) as Record<string, unknown>;
      const mechanismId =
        typeof x.mechanism_id === "string" ? x.mechanism_id : typeof x.id === "string" ? x.id : "";
      if (!MECHANISM_BY_ID.has(mechanismId)) return null;
      const pointId =
        Number.isInteger(x.point_id) && Number(x.point_id) >= 0
          ? Number(x.point_id)
          : Math.min(idx, news_points.length - 1);
      const reason =
        typeof x.why_this_mechanism_cn === "string"
          ? x.why_this_mechanism_cn
          : typeof x.rationale_cn === "string"
            ? x.rationale_cn
            : "命中该机制";
      const quote =
        typeof x.evidence_quote_cn === "string"
          ? x.evidence_quote_cn
          : typeof x.evidence_cn === "string"
            ? x.evidence_cn
            : String(
                (news_points[pointId] as Record<string, unknown> | undefined)?.evidence_cn ?? "",
              );
      return {
        point_id: Math.max(0, Math.min(pointId, news_points.length - 1)),
        mechanism_id: mechanismId,
        why_this_mechanism_cn: reason.slice(0, 120),
        evidence_quote_cn: quote.slice(0, 80),
      } satisfies MechanismHit;
    })
    .filter((x): x is MechanismHit => x !== null);

  const claims: ViewpointClaim[] = claimsRaw
    .map((c, i) => {
      const x = (c ?? {}) as Record<string, unknown>;
      const claimCn = String(x.claim_cn ?? "").trim();
      if (!claimCn) return null;
      const claimId = String(x.claim_id ?? `c${i + 1}`);
      const vpCandidates = Array.isArray(x.vp_candidates)
        ? x.vp_candidates.map(String).filter((id) => VIEWPOINT_BY_ID.has(id))
        : [];
      const vpPickObj = (x.vp_pick ?? {}) as Record<string, unknown>;
      const vpPickId = String(vpPickObj.vp_id ?? "");
      const normalized: ViewpointClaim = {
        claim_id: claimId,
        claim_cn: claimCn,
        evidence_quote_cn: String(x.evidence_quote_cn ?? ""),
        vp_candidates: vpCandidates,
        vp_pick: {
          vp_id: vpPickId && VIEWPOINT_BY_ID.has(vpPickId) ? vpPickId : "",
          why_pick_cn: String(vpPickObj.why_pick_cn ?? ""),
        },
      };
      return normalized;
    })
    .filter((x): x is ViewpointClaim => x !== null);

  const normalizedClaims: ViewpointClaim[] = claims.map((c, idx) => {
    const topPool = VIEWPOINT_LIBRARY.slice(0, 80);
    const scored = scoreClaimAgainstViewpoint(c.claim_cn, topPool, mechanisms);
    const topIds = scored.slice(0, 5).map((s) => s.vp_id);
    const fallbackPointId = idx % news_points.length;
    return {
      claim_id: c.claim_id || `c${idx + 1}`,
      claim_cn: c.claim_cn,
      evidence_quote_cn:
        c.evidence_quote_cn || deriveEvidenceQuote(news_points as NewsPoint[], fallbackPointId),
      vp_candidates: c.vp_candidates.length > 0 ? c.vp_candidates.slice(0, 5) : topIds,
      vp_pick:
        c.vp_pick.vp_id && VIEWPOINT_BY_ID.has(c.vp_pick.vp_id)
          ? c.vp_pick
          : {
              vp_id: topIds[0] ?? "VP001",
              why_pick_cn: c.vp_pick.why_pick_cn || "基于关键词命中与机制重合得分最高",
            },
      vp_score_breakdown: {
        keyword_hit: scored[0]?.keyword_hit ?? 0,
        question_hit: scored[0]?.question_hit ?? 0,
        mechanism_overlap: scored[0]?.mechanism_overlap ?? 0,
        total: scored[0]?.total ?? 0,
      },
    };
  });

  while (normalizedClaims.length < 3) {
    const i = normalizedClaims.length;
    const fallbackText = String(
      (news_points[i] as Record<string, unknown> | undefined)?.point_cn ?? "关键观点",
    );
    const scored = scoreClaimAgainstViewpoint(
      fallbackText,
      VIEWPOINT_LIBRARY.slice(0, 80),
      mechanisms,
    );
    const pick = scored[0]?.vp_id ?? "VP001";
    normalizedClaims.push({
      claim_id: `c${i + 1}`,
      claim_cn: fallbackText,
      evidence_quote_cn: deriveEvidenceQuote(news_points as NewsPoint[], i),
      vp_candidates: scored.slice(0, 5).map((s) => s.vp_id),
      vp_pick: {
        vp_id: pick,
        why_pick_cn: "由规则匹配自动补全",
      },
      vp_score_breakdown: {
        keyword_hit: scored[0]?.keyword_hit ?? 0,
        question_hit: scored[0]?.question_hit ?? 0,
        mechanism_overlap: scored[0]?.mechanism_overlap ?? 0,
        total: scored[0]?.total ?? 0,
      },
    });
  }

  return {
    news_points: news_points as NewsPoint[],
    mechanisms,
    claims: normalizedClaims,
    questions: questions as string[],
    search_queries: search_queries as string[],
    confidence,
  };
}

function parseAndValidate(raw: string): AnalysisResult {
  const extracted = extractJsonObject(raw);
  if (!extracted.ok) {
    throw new AppError("BAD_UPSTREAM", 503, `LLM 输出解析失败：${extracted.reason}`);
  }
  return validateAnalysis(extracted.value);
}

export async function analyzeAi(text: string, llm: LlmClient): Promise<AnalysisResult> {
  let lastError: AppError | null = null;

  for (const promptPrefix of ["", RETRY_PROMPT_PREFIX]) {
    try {
      const response = await llm.complete([
        { role: "user", content: promptPrefix + ANALYSIS_PROMPT + text },
      ]);
      return parseAndValidate(response);
    } catch (e) {
      if (e instanceof AppError && e.code === "BAD_UPSTREAM") {
        lastError = e;
        if (promptPrefix === "") continue;
      }
      throw e;
    }
  }

  throw lastError ?? new AppError("BAD_UPSTREAM", 503, "LLM 输出解析失败，请重试");
}
