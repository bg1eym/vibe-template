/**
 * LLM client abstraction for AI analysis.
 * Config via env: LLM_PROVIDER, LLM_MODEL, LLM_API_KEY.
 * No keys in code/docs. Injectable for tests.
 */
import { AppError } from "./errors.js";

export type LlmConfig = {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
};

export type LlmClient = {
  complete(messages: { role: string; content: string }[]): Promise<string>;
};

function getBaseUrl(provider: string): string {
  const lower = provider.toLowerCase();
  if (lower === "openai") return "https://api.openai.com/v1";
  if (lower === "anthropic") return "https://api.anthropic.com/v1";
  return process.env.LLM_BASE_URL || "https://api.openai.com/v1";
}

export function getLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig | null {
  const provider = (env.LLM_PROVIDER ?? "openai").trim().toLowerCase();
  if (provider === "fake") {
    return { provider: "fake", model: "fake", apiKey: "fake" };
  }
  const apiKey = (env.LLM_API_KEY ?? "").trim();
  if (!apiKey) return null;
  const model = (env.LLM_MODEL ?? "gpt-4o-mini").trim();
  const baseUrl = (env.LLM_BASE_URL ?? getBaseUrl(provider)).trim();
  return { provider, model, apiKey, baseUrl };
}

function createOpenAiClient(cfg: LlmConfig): LlmClient {
  return {
    async complete(messages: { role: string; content: string }[]) {
      const url = cfg.baseUrl
        ? `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`
        : `https://api.openai.com/v1/chat/completions`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: 0.3,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        if (res.status === 401) {
          throw new AppError("UNAUTHORIZED", 401, "LLM API key invalid");
        }
        throw new AppError(
          "BAD_UPSTREAM",
          502,
          `LLM API error ${res.status}: ${body.slice(0, 200)}`,
        );
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content;
      if (content == null) {
        throw new AppError("BAD_UPSTREAM", 502, "LLM returned empty response");
      }
      return content;
    },
  };
}

const FAKE_ANALYSIS = JSON.stringify({
  news_points: [
    { point_cn: "新闻点一", evidence_cn: "证据", keywords_cn: ["关键词"] },
    { point_cn: "新闻点二", evidence_cn: "证据", keywords_cn: ["关键词"] },
    { point_cn: "新闻点三", evidence_cn: "证据", keywords_cn: ["关键词"] },
  ],
  mechanisms: [{ id: "m1", name_cn: "机制", rationale_cn: "理由" }],
  claims: [{ claim_cn: "主张", pro_cn: "支持", con_cn: "反对" }],
  questions: ["q1", "q2", "q3", "q4", "q5", "q6"],
  search_queries: ["搜索"],
  confidence: 0.9,
});

const FAKE_MATCH_CATALOG = [
  { source_id: "Dune", work_cn: "沙丘", author: "Frank Herbert", quote: "Spice extends life" },
  { source_id: "1984", work_cn: "一九八四", author: "George Orwell" },
  { source_id: "Neuromancer", work_cn: "神经漫游者", author: "William Gibson" },
  { source_id: "The Martian", work_cn: "火星救援", author: "Andy Weir" },
  { source_id: "Blade Runner", work_cn: "银翼杀手", author: "Philip K. Dick" },
  { source_id: "Foundation", work_cn: "基地", author: "Isaac Asimov" },
  { source_id: "The Time Machine", work_cn: "时间机器", author: "H.G. Wells" },
  { source_id: "Ender's Game", work_cn: "安德的游戏", author: "Orson Scott Card" },
  { source_id: "Brave New World", work_cn: "美丽新世界", author: "Aldous Huxley" },
  { source_id: "Contact", work_cn: "接触", author: "Carl Sagan" },
  { source_id: "Snow Crash", work_cn: "雪崩", author: "Neal Stephenson" },
  { source_id: "The Left Hand of Darkness", work_cn: "黑暗的左手", author: "Ursula K. Le Guin" },
  { source_id: "Ex Machina", work_cn: "机械姬", author: "Alex Garland" },
  { source_id: "Arrival", work_cn: "降临", author: "Ted Chiang" },
  { source_id: "Altered Carbon", work_cn: "碳变", author: "Richard K. Morgan" },
  { source_id: "Hyperion", work_cn: "海伯利安", author: "Dan Simmons" },
  { source_id: "Do Androids Dream", work_cn: "仿生人会梦见电子羊吗", author: "Philip K. Dick" },
  {
    source_id: "The Three-Body Problem",
    work_cn: "三体",
    author: "Liu Cixin",
  },
  { source_id: "Annihilation", work_cn: "湮灭", author: "Jeff VanderMeer" },
  { source_id: "Ready Player One", work_cn: "头号玩家", author: "Ernest Cline" },
  { source_id: "Project Hail Mary", work_cn: "挽救计划", author: "Andy Weir" },
  { source_id: "Children of Time", work_cn: "时间的孩子", author: "Adrian Tchaikovsky" },
  { source_id: "The Dispossessed", work_cn: "一无所有", author: "Ursula K. Le Guin" },
  { source_id: "Dark Matter", work_cn: "暗物质", author: "Blake Crouch" },
  { source_id: "Station Eleven", work_cn: "第十一站", author: "Emily St. John Mandel" },
];

const FAKE_SCENE =
  "角色：保罗。组织：弗雷曼人。事件：在沙漠中接受训练，通过饮用生命之水完成蜕变。转折：成为预言中的救世主。决定：承担预言使命，改变了整个星球的权力格局与政治博弈";
const FAKE_MAPPING =
  "新闻侧：新闻点一关于政策影响，涉及关键词与社会机制。作品侧：沙丘中厄拉科斯星球的香料控制权争夺。机制名：机制。同构点：权力委托与资源垄断在现实与科幻中形成映射对照";
const FAKE_WHY =
  "因为权力委托机制在现实政策与科幻叙事中具有同构性，因此沙丘中的香料政治能够映射新闻中的政策博弈，机制层面的反馈循环导致相似的权力集中";

function buildFakeCandidates(catalog = FAKE_MATCH_CATALOG) {
  return catalog.map((c, i) => ({
    id: `fake-${i}`,
    source_id: c.source_id,
    work_cn: c.work_cn,
    author: c.author,
    scene_cn: FAKE_SCENE.replace("保罗", c.work_cn + "主角"),
    mapping_cn: FAKE_MAPPING,
    why_this_is_relevant_cn: FAKE_WHY,
    quote_en: (c as Record<string, unknown>).quote ?? undefined,
    confidence: 0.9,
  }));
}

function buildFakeAuditResults(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `fake-${i}`,
    score: { relevance: 4, specificity: 4, mechanism_fit: 4, novelty: 3, human_plausibility: 4 },
    verdict: i < 16 ? "keep" : "maybe",
    reasons_cn: [],
    fix_suggestions_cn: [],
  }));
}

const FAKE_GENERATE = JSON.stringify({
  candidates: buildFakeCandidates(),
});

/* Legacy format for repair endpoint */
const FAKE_MATCH = JSON.stringify({
  matches: FAKE_MATCH_CATALOG.slice(0, 8).map((c) => ({
    source_id: c.source_id,
    work_cn: c.work_cn,
    work_en: c.source_id,
    author: c.author,
    scene_cn: FAKE_SCENE,
    mapping_cn: FAKE_MAPPING,
    why_this_is_relevant_cn: FAKE_WHY,
    quote_en: (c as Record<string, unknown>).quote ?? undefined,
    confidence: 0.9,
  })),
});

function createFakeClient(): LlmClient {
  return {
    async complete(messages: { role: string; content: string }[]) {
      const content = messages[0]?.content ?? "";
      /* improve step (must be before analyze_ai due to overlapping keywords) */
      if (content.includes("改写以下候选条目") || content.includes("改写目标")) {
        const idMatches = content.match(/"id":\s*"([^"]+)"/g) ?? [];
        const candidates = idMatches
          .map((m) => {
            const id = m.match(/"id":\s*"([^"]+)"/)?.[1] ?? "unknown";
            if (id === "原id" || id === "候选id") return null;
            return {
              id,
              source_id: "Dune",
              work_cn: "沙丘",
              author: "Frank Herbert",
              scene_cn: FAKE_SCENE.replace("保罗", "改写后主角"),
              mapping_cn: FAKE_MAPPING.replace("新闻侧", "改写后新闻侧"),
              why_this_is_relevant_cn: FAKE_WHY.replace("因为", "改写后因为"),
              confidence: 0.95,
            };
          })
          .filter(Boolean);
        return JSON.stringify({ candidates });
      }
      /* analyze_ai */
      if (content.includes("新闻分析专家") || content.includes("news_points")) {
        return FAKE_ANALYSIS;
      }
      /* audit/critic step */
      if (content.includes("播客节目制作人") || content.includes("逐条评分")) {
        const idMatches = content.match(/"id":/g);
        const count = idMatches ? idMatches.length : 12;
        return JSON.stringify({ audited: buildFakeAuditResults(count) });
      }
      /* expand step */
      if (content.includes("补充") && content.includes("新的高质量匹配")) {
        return JSON.stringify({
          candidates: buildFakeCandidates(FAKE_MATCH_CATALOG.slice(12, 20)).map((c, i) => ({
            ...c,
            id: `expand-${i}`,
          })),
        });
      }
      /* generate step */
      if (content.includes("请生成") && content.includes("条科幻作品与新闻的类比匹配")) {
        return FAKE_GENERATE;
      }
      /* repair (legacy) */
      if (content.includes("定向修补")) {
        return FAKE_MATCH;
      }
      return FAKE_GENERATE;
    },
  };
}

export function createLlmClient(cfg: LlmConfig | null): LlmClient | null {
  if (!cfg) return null;
  if (cfg.provider === "fake") return createFakeClient();
  return createOpenAiClient(cfg);
}
