import type { ScifiEntry, PlotSupportCard } from "./types.js";
import { toTitleZh, toCatZh, toMechZh } from "./types.js";

export function buildPlotSupportCards(
  selectedCategories: string[],
  selectedWorks: ScifiEntry[],
): PlotSupportCard[] {
  const cards: PlotSupportCard[] = [];
  const catStr = selectedCategories.map(toCatZh).join("、") || "主题";
  const worksWithTitle = selectedWorks.filter((w) => toTitleZh(w.title) != null);
  for (const w of worksWithTitle) {
    const tZh = toTitleZh(w.title)!;
    const hooks = w.hooks || [];
    const mech = w.mechanism ? toMechZh(w.mechanism) : "";
    const themes = (w.themes || []).filter((t) => selectedCategories.includes(t)).map(toCatZh);
    const themeStr = themes.length ? themes.join("、") : catStr;
    for (let i = 0; i < Math.max(1, Math.ceil(3 / worksWithTitle.length)); i++) {
      const hookEn = hooks[i] || hooks[0] || "";
      cards.push({
        scene_title_cn: `《${tZh}》中的关键场景`,
        plot_summary_cn: `《${tZh}》讲述核心设定与情节发展。${themeStr} 主题贯穿其中，${mech ? mech + " 机制" : "相关机制"}推动叙事，可作为思想实验探讨现实议题。`,
        mapping_cn: `该设定映射到现实中的 ${themeStr} 与 ${mech || "相关机制"} 议题，当现实条件与之吻合时即可类比，引发对当下社会的思考。`,
        podcast_question_cn: `《${tZh}》中的设定如何映射到现实？${themeStr} 主题在当今社会有哪些具体体现？`,
        source_id: w.title,
        source_title_cn: tZh,
        source_quote_en: hookEn || undefined,
      });
      if (cards.length >= 3) break;
    }
    if (cards.length >= 3) break;
  }
  while (cards.length < 3 && worksWithTitle.length > 0) {
    const w = worksWithTitle[cards.length % worksWithTitle.length];
    const tZh = toTitleZh(w.title)!;
    cards.push({
      scene_title_cn: `《${tZh}》延伸场景`,
      plot_summary_cn: `《${tZh}》探讨核心议题与设定，可作为思想实验探讨现实中的相关机制与主题映射。`,
      mapping_cn: `与 ${catStr} 相关的现实议题可由此展开讨论，当现实条件与作品设定吻合时即可类比。`,
      podcast_question_cn: `如何用《${tZh}》的视角看待当下？该作品提供了哪些思考框架？`,
      source_id: w.title,
      source_title_cn: tZh,
      source_quote_en: (w.hooks || [])[0] || undefined,
    });
  }
  if (cards.length >= 3) return cards;
  const lastWork = worksWithTitle[worksWithTitle.length - 1];
  const tZh = lastWork ? toTitleZh(lastWork.title)! : "所选作品";
  const padSourceId = lastWork ? lastWork.title : "fallback";
  const pad = Array.from({ length: 3 - cards.length }, (_, i) => ({
    scene_title_cn: `补充场景 ${i + 1}`,
    plot_summary_cn: `基于所选分类 ${catStr} 与作品的综合概述，探讨核心设定如何映射到现实议题。`,
    mapping_cn: `映射到现实中的 ${catStr} 相关议题，可作为思想实验展开讨论。`,
    podcast_question_cn: `如何将所选作品与 ${catStr} 关联？该作品提供了哪些分析视角？`,
    source_id: padSourceId,
    source_title_cn: tZh,
    source_quote_en: undefined as string | undefined,
  }));
  return cards.concat(pad);
}
