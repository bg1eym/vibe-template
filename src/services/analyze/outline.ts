import type { ScifiEntry, AnalyzePodcastOutline, ExpandResult } from "./types.js";
import { toTitleZh, toCatZh, toMechZh } from "./types.js";

export function buildAnalyzePodcastOutline(
  categories: Array<{ category: string; score: number }>,
  scifiMatches: Array<ScifiEntry & { overlap: number }>,
  mechanismMatches: ScifiEntry[],
): AnalyzePodcastOutline {
  const catNames = categories.map((c) => toCatZh(c.category)).join("、");
  const mechNames = mechanismMatches
    .map((m) => toMechZh(m.mechanism || ""))
    .filter(Boolean)
    .join("、");
  const titles = [...scifiMatches, ...mechanismMatches]
    .map((w) => toTitleZh(w.title))
    .filter((t): t is string => t != null);
  const titleStr =
    titles
      .slice(0, 2)
      .map((t) => `《${t}》`)
      .join("、") || "所选作品";
  const rawHooks = scifiMatches.flatMap((m) => m.hooks || []).filter((h) => h.length >= 10);
  const analogyFromHooks = rawHooks
    .slice(0, 2)
    .map((h) => `「${h}」—— 该设定映射到现实中的 ${catNames} 与 ${mechNames} 议题。`);
  const generatedAnalogies: string[] = [];
  for (const m of mechanismMatches) {
    if (generatedAnalogies.length >= 2) break;
    const t = toTitleZh(m.title);
    if (!t) continue;
    const mech = toMechZh(m.mechanism || "");
    generatedAnalogies.push(
      `在《${t}》中，${mech} 机制映射到 ${catNames} 主题，当现实条件与之吻合时即可类比。`,
    );
  }
  const analogyScenarios = [...analogyFromHooks, ...generatedAnalogies].slice(0, 2);
  while (analogyScenarios.length < 2) {
    analogyScenarios.push(`基于 ${catNames} 与 ${mechNames} 的综合类比场景。`);
  }

  return {
    opening_hook: `若 ${catNames} 与 ${mechNames} 等机制不只是科幻呢？我们探讨 ${titleStr} 如何映射到现实议题。`,
    framing: [
      `分类 ${catNames} 在虚构与现实中均有呈现。`,
      `机制（${mechNames}）提供分析视角。`,
      `${catNames} 与 ${mechNames} 的重叠暗示共同的人类关切。`,
    ],
    debate: {
      thesis: `主题 ${catNames} 与机制 ${mechNames} 可预测现实走向。`,
      antithesis: `现实更复杂：${catNames} 过于简化；${mechNames} 未必可迁移。`,
      synthesis: `将 ${titleStr} 等作为思想实验，而非预言。`,
    },
    analogy_scenarios: analogyScenarios,
    counterexamples: [
      `现实中 ${catNames} 很少像虚构作品那样汇聚；制度会抵抗。`,
      `机制 ${mechNames} 假定现实中的 ${categories[0] ? toCatZh(categories[0].category) : "系统"} 往往不具备的条件。`,
    ],
    closing: `分类 ${catNames} 与机制 ${mechNames} 在 ${titleStr} 中的呈现，提醒我们始终围绕同一类问题。带着这一视角继续探索。`,
  };
}

export function buildPodcastOutline(
  selectedCategories: string[],
  selectedWorks: ScifiEntry[],
): ExpandResult["podcastOutline"] {
  const catStr = selectedCategories.map(toCatZh).join("、") || "主题";
  const titles = selectedWorks
    .map((w) => toTitleZh(w.title))
    .filter((t): t is string => t != null)
    .slice(0, 3);
  const titleStr = titles.length ? titles.map((t) => `《${t}》`).join("、") : "所选作品";
  return {
    opening_cn: `若 ${catStr} 不只是科幻呢？我们探讨 ${titleStr} 如何映射到现实议题。`,
    framing_cn: [
      `分类 ${catStr} 在虚构与现实中均有呈现。`,
      `${titleStr} 提供分析视角与思想实验素材。`,
      `从机制与主题重叠切入，展开讨论。`,
    ],
    closing_cn: `带着 ${catStr} 与 ${titleStr} 的视角继续探索。`,
  };
}
