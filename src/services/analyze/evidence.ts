import type { ScifiEntry, AnalyzeEvidenceLink, AnalyzeEvidenceRef, EvidenceLink } from "./types.js";
import { toTitleZh, toCatZh, toMechZh } from "./types.js";

export function buildAnalyzeEvidenceChain(
  categories: Array<{ category: string; score: number }>,
  scifiMatches: Array<ScifiEntry & { overlap: number }>,
  mechanismMatches: ScifiEntry[],
): AnalyzeEvidenceLink[] {
  const catZh = categories.map((c) => toCatZh(c.category));
  const mechZh = [
    ...new Set(mechanismMatches.map((m) => toMechZh(m.mechanism || "")).filter(Boolean)),
  ];
  const allWorks = [...scifiMatches, ...mechanismMatches].slice(0, 6);
  const scifiRefs: AnalyzeEvidenceRef[] = [];
  for (const w of allWorks) {
    const titleCn = toTitleZh(w.title);
    if (!titleCn) continue;
    const hookEn = (w.hooks || [])[0] || "";
    const themeCat = toCatZh((w.themes || [])[0] || "主题");
    const mech = toMechZh(w.mechanism || "");
    const hookCn =
      hookEn.length >= 10
        ? `该作品中的关键设定「${hookEn.slice(0, 30)}…」，映射到 ${themeCat} 与 ${mech} 议题，可作为思想实验探讨。`
        : `该作品核心情节与 ${themeCat}、${mech} 主题相关，映射到现实中的相关机制与认知议题。`;
    scifiRefs.push({
      source_id: w.title,
      title_cn: titleCn,
      hook_cn: hookCn,
      quote_en: hookEn || undefined,
    });
  }
  return [
    {
      categories: catZh.length ? catZh : ["主题"],
      mechanisms: mechZh.length ? mechZh : ["机制"],
      scifiRefs,
    },
  ];
}

export function buildEvidenceChain(
  selectedCategories: string[],
  selectedWorks: ScifiEntry[],
): EvidenceLink[] {
  const catZh = selectedCategories.map(toCatZh);
  const mechZh = [
    ...new Set(selectedWorks.map((w) => toMechZh(w.mechanism || "")).filter(Boolean)),
  ];
  const scifiRefs = selectedWorks
    .filter((w) => toTitleZh(w.title) != null)
    .map((w) => {
      const hookEn = (w.hooks || [])[0] || "";
      const themeCat = toCatZh((w.themes || [])[0] || "主题");
      const mech = toMechZh(w.mechanism || "");
      return {
        source_id: w.title,
        title_cn: toTitleZh(w.title)!,
        hook_cn: hookEn
          ? `该作品中的关键设定，映射到 ${themeCat} 与 ${mech} 相关议题，可作为思想实验探讨。`
          : `核心情节与 ${themeCat}、${mech} 主题相关，映射到现实中的相关机制与认知议题。`,
        quote_en: hookEn || undefined,
      };
    });
  return [
    {
      categories: catZh.length ? catZh : ["主题"],
      mechanisms: mechZh.length ? mechZh : ["机制"],
      scifiRefs,
    },
  ];
}
