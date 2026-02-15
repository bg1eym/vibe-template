import type { ScifiEntry, RecommendedTrack, ScifiCandidate } from "./types.js";
import { toTitleZh, toCatZh, toMechZh } from "./types.js";

export function buildRecommendedTracks(
  categories: Array<{ category: string; score: number }>,
  scifiMatches: Array<ScifiEntry & { overlap: number }>,
  mechanismMatches: ScifiEntry[],
): RecommendedTrack[] {
  const tracks: RecommendedTrack[] = [];
  const catZh = categories.map((c) => toCatZh(c.category));
  const mechZh = [
    ...new Set(mechanismMatches.map((m) => toMechZh(m.mechanism || "")).filter(Boolean)),
  ];
  const allWorks = [...scifiMatches, ...mechanismMatches].filter((w) => toTitleZh(w.title) != null);
  const candidates: ScifiCandidate[] = allWorks.slice(0, 6).map((w) => ({
    title: w.title,
    intro_cn: `《${toTitleZh(w.title)!}》探讨核心议题。`,
  }));

  if (catZh.length > 0 && mechZh.length > 0) {
    const cids = categories.map((c) => c.category);
    const cands = candidates.slice(0, 4);
    tracks.push({
      trackId: "track-1",
      title: "主题与机制综合路径",
      confidence: 0.9,
      categories: catZh,
      categoryIds: cids,
      mechanisms: mechZh,
      scifiCandidates: cands,
      scifiCandidateTitles: cands.map((c) => c.title),
      whyThisTrack: `文本同时涉及 ${catZh.slice(0, 2).join("、")} 等主题与 ${mechZh.slice(0, 2).join("、")} 等机制，推荐综合探讨。`,
    });
  }

  if (scifiMatches.length > 0) {
    const themeCat = [...new Set(scifiMatches.flatMap((m) => (m.themes || []).map(toCatZh)))].slice(
      0,
      3,
    );
    const themeIds = [...new Set(scifiMatches.flatMap((m) => m.themes || []))].slice(0, 3);
    const cands = scifiMatches
      .filter((w) => toTitleZh(w.title) != null)
      .slice(0, 4)
      .map((w) => ({
        title: w.title,
        intro_cn: `《${toTitleZh(w.title)!}》探讨核心议题。`,
      }));
    tracks.push({
      trackId: "track-2",
      title: "科幻主题聚焦路径",
      confidence: 0.85,
      categories: themeCat.length ? themeCat : catZh,
      categoryIds: themeIds.length ? themeIds : categories.map((c) => c.category),
      mechanisms: mechZh.slice(0, 2),
      scifiCandidates: cands,
      scifiCandidateTitles: cands.map((c) => c.title),
      whyThisTrack: `匹配到多部科幻作品，可从 ${themeCat[0] || "主题"} 角度切入讨论。`,
    });
  }

  if (mechanismMatches.length > 0) {
    const mechWorks = mechanismMatches
      .filter((w) => toTitleZh(w.title) != null)
      .slice(0, 4)
      .map((w) => ({
        title: w.title,
        intro_cn: `《${toTitleZh(w.title)!}》涉及 ${toMechZh(w.mechanism || "")} 机制。`,
      }));
    tracks.push({
      trackId: "track-3",
      title: "机制驱动路径",
      confidence: 0.8,
      categories: catZh.slice(0, 2),
      categoryIds: categories.map((c) => c.category).slice(0, 2),
      mechanisms: mechZh,
      scifiCandidates: mechWorks,
      scifiCandidateTitles: mechWorks.map((c) => c.title),
      whyThisTrack: `文本触发 ${mechZh.slice(0, 2).join("、")} 等机制匹配，适合从机制角度展开。`,
    });
  }

  return tracks.length >= 2
    ? tracks
    : tracks.concat([
        {
          trackId: "track-fallback",
          title: "通用分析路径",
          confidence: 0.7,
          categories: catZh.length ? catZh : ["主题"],
          categoryIds: categories.map((c) => c.category),
          mechanisms: mechZh.length ? mechZh : ["机制"],
          scifiCandidates: candidates.slice(0, 3),
          scifiCandidateTitles: candidates.slice(0, 3).map((c) => c.title),
          whyThisTrack: "基于分类与机制匹配的通用推荐路径。",
        } as RecommendedTrack,
      ]);
}
