import type { MechanismHit, NewsPoint } from "./analyzeAiService.js";
import type { ViewpointEntry } from "../data/viewpointLibrary.js";

export type ViewpointScoreBreakdown = {
  vp_id: string;
  keyword_hit: number;
  question_hit: number;
  mechanism_overlap: number;
  total: number;
};

function countIncludes(text: string, words: string[]): number {
  let n = 0;
  for (const w of words) {
    if (w && text.includes(w)) n++;
  }
  return n;
}

export function scoreClaimAgainstViewpoint(
  claimText: string,
  viewpoints: ViewpointEntry[],
  mechanisms: MechanismHit[],
): ViewpointScoreBreakdown[] {
  const mechSet = new Set(mechanisms.map((m) => m.mechanism_id));
  const source = claimText || "";
  const out: ViewpointScoreBreakdown[] = viewpoints.map((vp) => {
    const keyword_hit = countIncludes(source, vp.evidence_patterns);
    const question_hit = countIncludes(
      source,
      vp.diagnostic_questions_cn.map((q) => q.slice(0, 6)),
    );
    const mechanism_overlap = vp.related_mechanism_ids.filter((id) => mechSet.has(id)).length;
    return {
      vp_id: vp.vp_id,
      keyword_hit,
      question_hit,
      mechanism_overlap,
      total: keyword_hit + question_hit + mechanism_overlap,
    };
  });
  out.sort((a, b) => b.total - a.total);
  return out;
}

export function deriveEvidenceQuote(newsPoints: NewsPoint[], pointId: number): string {
  const p = newsPoints[Math.max(0, Math.min(pointId, newsPoints.length - 1))];
  return (p?.evidence_cn ?? "").slice(0, 80);
}
