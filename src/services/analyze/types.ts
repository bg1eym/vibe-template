/** Shared types and locale helpers for analyze/expand. */

export type ScifiEntry = {
  title: string;
  author: string;
  premise: string;
  themes: string[];
  mechanism?: string;
  hooks: string[];
};

const CAT_ZH: Record<string, string> = {
  space: "太空",
  time_travel: "时间旅行",
  ai: "人工智能",
  dystopia: "反乌托邦",
  contact: "接触",
  genetics: "遗传",
  cyberpunk: "赛博朋克",
  consciousness: "意识",
};

const MECH_ZH: Record<string, string> = {
  "delegated authority": "委托权力",
  "epistemic collapse": "认知崩塌",
  "automation deskilling": "自动化去技能",
  "identity copy": "身份复制",
  "surveillance economy": "监控经济",
  "epistemic dependence": "认知依赖",
};

const TITLE_ZH: Record<string, string> = {
  Dune: "沙丘",
  "1984": "一九八四",
  Neuromancer: "神经漫游者",
  "The Martian": "火星救援",
  "Blade Runner": "银翼杀手",
  Foundation: "基地",
  "The Time Machine": "时间机器",
  "Ender's Game": "安德的游戏",
  "Snow Crash": "雪崩",
  Contact: "接触",
  "Brave New World": "美丽新世界",
  "Ex Machina": "机械姬",
  Arrival: "降临",
  "Altered Carbon": "碳变",
  "The Left Hand of Darkness": "黑暗的左手",
  Hyperion: "海伯利安",
  "Do Androids Dream": "仿生人会梦见电子羊吗",
  "The Three-Body Problem": "三体",
  Annihilation: "湮灭",
  "Ready Player One": "头号玩家",
  "Project Hail Mary": "挽救计划",
  "Children of Time": "时间之子",
  "The Dispossessed": "一无所有",
  "Dark Matter": "黑暗物质",
  "Station Eleven": "十一号站",
  "Red Mars": "红火星",
  "The Windup Girl": "发条女孩",
  Solaris: "索拉里斯星",
  "I, Robot": "我，机器人",
  "The City and the Stars": "城市与群星",
  "Parable of the Sower": "播种者寓言",
};

export function toTitleZh(title: string): string | null {
  return TITLE_ZH[title] ?? null;
}

export function toCatZh(id: string): string {
  return CAT_ZH[id] || id;
}

export function toMechZh(id: string): string {
  return MECH_ZH[id] || id;
}

export type ScifiCandidate = {
  title: string;
  intro_cn: string;
};

export type RecommendedTrack = {
  trackId: string;
  title: string;
  confidence: number;
  categories: string[];
  categoryIds: string[];
  mechanisms: string[];
  scifiCandidates: ScifiCandidate[];
  scifiCandidateTitles: string[];
  whyThisTrack: string;
};

export type AnalyzeEvidenceRef = {
  source_id: string;
  title_cn: string;
  hook_cn: string;
  quote_en?: string;
};

export type AnalyzeEvidenceLink = {
  categories: string[];
  mechanisms: string[];
  scifiRefs: AnalyzeEvidenceRef[];
};

export type AnalyzePodcastOutline = {
  opening_hook: string;
  framing: string[];
  debate: { thesis: string; antithesis: string; synthesis: string };
  analogy_scenarios: string[];
  counterexamples: string[];
  closing: string;
};

export type AnalyzeResult = {
  categories: Array<{ category: string; score: number }>;
  scifiMatches: Array<ScifiEntry & { overlap: number }>;
  mechanismMatches: ScifiEntry[];
  recommendedTracks: RecommendedTrack[];
  podcastOutline: AnalyzePodcastOutline;
  evidenceChain: AnalyzeEvidenceLink[];
};

export type PlotSupportCard = {
  scene_title_cn: string;
  plot_summary_cn: string;
  mapping_cn: string;
  podcast_question_cn: string;
  source_id: string;
  source_title_cn: string;
  source_quote_en?: string;
};

export type EvidenceLink = {
  categories: string[];
  mechanisms: string[];
  scifiRefs: Array<{ source_id: string; title_cn: string; hook_cn: string; quote_en?: string }>;
};

export type ExpandResult = {
  plotSupportCards: PlotSupportCard[];
  podcastOutline?: { opening_cn: string; framing_cn: string[]; closing_cn: string };
  evidenceChain: EvidenceLink[];
};
