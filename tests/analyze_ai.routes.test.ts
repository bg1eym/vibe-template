/**
 * AI 分析路由测试：使用 fake LLM client，不打外网。
 * Fast mode: /match_scifi_ai returns candidates + recommended_for_ui (1 LLM call).
 */
import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import type { LlmClient } from "../src/lib/llmClient.js";
import { MECHANISM_BY_ID } from "../src/data/mechanismLibrary.js";

const FAKE_ANALYSIS_JSON = {
  news_points: [
    { point_cn: "新闻点一：某政策影响", evidence_cn: "证据A", keywords_cn: ["政策", "影响"] },
    { point_cn: "新闻点二：技术突破", evidence_cn: "证据B", keywords_cn: ["技术"] },
    { point_cn: "新闻点三：社会反响", evidence_cn: "证据C", keywords_cn: ["社会"] },
  ],
  mechanisms: [
    {
      point_id: 0,
      mechanism_id: "M10",
      why_this_mechanism_cn: "自动化可能影响医生训练强度",
      evidence_quote_cn: "医生需要训练专业诊断能力",
    },
  ],
  claims: [
    {
      claim_id: "c1",
      claim_cn: "主张1",
      evidence_quote_cn: "证据A",
      vp_candidates: ["VP001", "VP002", "VP003"],
      vp_pick: { vp_id: "VP001", why_pick_cn: "关键词匹配高" },
    },
  ],
  questions: ["问题1？", "问题2？", "问题3？", "问题4？", "问题5？", "问题6？", "问题7？"],
  search_queries: ["搜索1", "搜索2"],
  confidence: 0.85,
};

const FAKE_MATCH_SCENE =
  "角色：保罗。组织：弗雷曼人。事件：沙漠中接受训练，饮用生命之水完成蜕变。转折：成为预言中的救世主。决定：承担使命。改变了整个星球的权力格局与政治博弈";
const FAKE_MATCH_MAPPING =
  "新闻点一关于政策影响，与沙丘中厄拉科斯星球的香料控制权争夺形成映射，机制一体现在权力委托与资源垄断的相似性，符合机制同构";
const FAKE_MATCH_WHY =
  "因为权力委托机制在现实政策与科幻叙事中具有同构性，因此沙丘中的香料政治能够映射新闻中的政策博弈，机制层面的反馈循环导致相似的权力集中";

const FAKE_MATCH_CATALOG = [
  { source_id: "Dune", work_cn: "沙丘", author: "Frank Herbert", quote: "Spice extends life" },
  { source_id: "1984", work_cn: "一九八四", author: "George Orwell", quote: undefined },
  { source_id: "Neuromancer", work_cn: "神经漫游者", author: "William Gibson", quote: undefined },
  { source_id: "The Martian", work_cn: "火星救援", author: "Andy Weir", quote: undefined },
  { source_id: "Blade Runner", work_cn: "银翼杀手", author: "Philip K. Dick", quote: undefined },
  { source_id: "Foundation", work_cn: "基地", author: "Isaac Asimov", quote: undefined },
  { source_id: "The Time Machine", work_cn: "时间机器", author: "H.G. Wells", quote: undefined },
  {
    source_id: "Ender's Game",
    work_cn: "安德的游戏",
    author: "Orson Scott Card",
    quote: undefined,
  },
];

const FAKE_MATCH_JSON = {
  candidates: FAKE_MATCH_CATALOG.map((c) => ({
    source_id: c.source_id,
    work_cn: c.work_cn,
    author: c.author,
    scene_cn: FAKE_MATCH_SCENE,
    mapping_cn: FAKE_MATCH_MAPPING,
    why_this_is_relevant_cn: FAKE_MATCH_WHY,
    quote_en: c.quote,
    confidence: 0.9,
  })),
};

function createFakeLlm(analyzeResponse: string, matchResponse: string): LlmClient {
  return {
    async complete(messages: { role: string; content: string }[]) {
      const content = messages[0]?.content ?? "";
      if (content.includes("新闻分析专家") || content.includes("news_points")) {
        return analyzeResponse;
      }
      return matchResponse;
    },
  };
}

describe("analyze_ai routes", () => {
  it("POST /analyze_ai returns analysis with news_points >= 3 and mechanisms field", async () => {
    const fakeLlm = createFakeLlm(
      JSON.stringify(FAKE_ANALYSIS_JSON),
      JSON.stringify(FAKE_MATCH_JSON),
    );
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/analyze_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { text: "测试新闻" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      success?: boolean;
      data?: { analysis?: { news_points?: unknown[]; mechanisms?: unknown[] } };
    };
    expect(body.success).toBe(true);
    expect(body.data?.analysis?.news_points?.length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(body.data?.analysis?.mechanisms)).toBe(true);

    await app.close();
    closeDb(db);
  });

  it("POST /analyze_ai returns questions >= 6", async () => {
    const fakeLlm = createFakeLlm(
      JSON.stringify(FAKE_ANALYSIS_JSON),
      JSON.stringify(FAKE_MATCH_JSON),
    );
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/analyze_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { text: "测试" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      success?: boolean;
      data?: { analysis?: { questions?: string[] } };
    };
    expect(body.data?.analysis?.questions?.length).toBeGreaterThanOrEqual(6);

    await app.close();
    closeDb(db);
  });

  it("POST /analyze_ai returns pipeline.llm_calls === 1", async () => {
    const fakeLlm = createFakeLlm(
      JSON.stringify(FAKE_ANALYSIS_JSON),
      JSON.stringify(FAKE_MATCH_JSON),
    );
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/analyze_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { text: "测试" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data?: { pipeline?: { llm_calls?: number } };
    };
    expect(body.data?.pipeline?.llm_calls).toBe(1);

    await app.close();
    closeDb(db);
  });

  it("POST /analyze_ai mechanisms[].mechanism_id should be valid", async () => {
    const fakeLlm = createFakeLlm(
      JSON.stringify(FAKE_ANALYSIS_JSON),
      JSON.stringify(FAKE_MATCH_JSON),
    );
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/analyze_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { text: "测试" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data?: {
        analysis?: {
          mechanisms?: Array<{ mechanism_id?: string; why_this_mechanism_cn?: string }>;
        };
      };
    };
    for (const m of body.data?.analysis?.mechanisms ?? []) {
      expect(MECHANISM_BY_ID.has(m.mechanism_id ?? "")).toBe(true);
      expect((m.why_this_mechanism_cn ?? "").length).toBeGreaterThan(0);
    }

    await app.close();
    closeDb(db);
  });

  it("POST /analyze_ai returns claims with vp_pick", async () => {
    const fakeLlm = createFakeLlm(
      JSON.stringify(FAKE_ANALYSIS_JSON),
      JSON.stringify(FAKE_MATCH_JSON),
    );
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/analyze_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { text: "测试" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data?: {
        analysis?: {
          claims?: Array<{
            claim_id?: string;
            vp_candidates?: string[];
            vp_pick?: { vp_id?: string };
          }>;
        };
      };
    };
    const first = body.data?.analysis?.claims?.[0];
    expect(first?.claim_id).toBeTruthy();
    expect((first?.vp_candidates ?? []).length).toBeGreaterThanOrEqual(1);
    expect(first?.vp_pick?.vp_id).toMatch(/^VP/);

    await app.close();
    closeDb(db);
  });

  it("POST /match_scifi_ai returns candidates >= 8", async () => {
    const fakeLlm = createFakeLlm(
      JSON.stringify(FAKE_ANALYSIS_JSON),
      JSON.stringify(FAKE_MATCH_JSON),
    );
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/match_scifi_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: {
        analysis: FAKE_ANALYSIS_JSON,
        selected_points: ["新闻点一"],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { success?: boolean; data?: { candidates?: unknown[] } };
    expect(body.data?.candidates?.length).toBeGreaterThanOrEqual(8);

    await app.close();
    closeDb(db);
  });

  it("POST /match_scifi_ai candidates contain Chinese in scene_cn, mapping_cn, why_this_is_relevant_cn", async () => {
    const fakeLlm = createFakeLlm(
      JSON.stringify(FAKE_ANALYSIS_JSON),
      JSON.stringify(FAKE_MATCH_JSON),
    );
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/match_scifi_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: {
        analysis: FAKE_ANALYSIS_JSON,
        selected_points: ["新闻点一"],
      },
    });

    expect(res.statusCode).toBe(200);
    const candidates =
      (
        res.json() as {
          data?: {
            candidates?: Array<{
              scene_cn?: string;
              mapping_cn?: string;
              why_this_is_relevant_cn?: string;
            }>;
          };
        }
      ).data?.candidates ?? [];
    for (const m of candidates) {
      expect(/[\u4e00-\u9fa5]/.test(m.scene_cn ?? "")).toBe(true);
      expect(/[\u4e00-\u9fa5]/.test(m.mapping_cn ?? "")).toBe(true);
      expect(/[\u4e00-\u9fa5]/.test(m.why_this_is_relevant_cn ?? "")).toBe(true);
    }

    await app.close();
    closeDb(db);
  });

  it("quote_en when present has 引用原文 in UI (domBuilder)", async () => {
    const { JSDOM } = await import("jsdom");
    const { renderAiMatchCard } = await import("../src/lib/view/domBuilders.js");
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
    const doc = dom.window.document;

    const card = renderAiMatchCard(
      doc,
      {
        work_cn: "沙丘",
        scene_cn: "场景",
        mapping_cn: "映射",
        why_this_is_relevant_cn: "相关",
        quote_en: "The quote",
      },
      0,
    );

    expect(card.outerHTML).toContain("引用原文");
    expect(card.querySelector(".quote-content")?.textContent).toBe("The quote");
  }, 15000);

  it("POST /analyze_ai without auth returns 401", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: createFakeLlm("{}", "{}") });

    const res = await app.inject({
      method: "POST",
      url: "/analyze_ai",
      headers: { "Content-Type": "application/json" },
      payload: { text: "test" },
    });

    expect(res.statusCode).toBe(401);

    await app.close();
    closeDb(db);
  });
});

describe("analyze_ai LLM output robustness", () => {
  it("code fence JSON returns 200 success", async () => {
    const raw = "```json\n" + JSON.stringify(FAKE_ANALYSIS_JSON) + "\n```";
    const fakeLlm = createFakeLlm(raw, JSON.stringify(FAKE_MATCH_JSON));
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/analyze_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { text: "测试" },
    });

    expect(res.statusCode).toBe(200);
    expect((res.json() as { success?: boolean }).success).toBe(true);

    await app.close();
    closeDb(db);
  });

  it("explanatory text + JSON returns 200 success", async () => {
    const raw = "Sure, here is the analysis:\n" + JSON.stringify(FAKE_ANALYSIS_JSON) + "\nThanks";
    const fakeLlm = createFakeLlm(raw, JSON.stringify(FAKE_MATCH_JSON));
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/analyze_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { text: "测试" },
    });

    expect(res.statusCode).toBe(200);
    expect((res.json() as { success?: boolean }).success).toBe(true);

    await app.close();
    closeDb(db);
  });

  it("missing news_points returns 503 BAD_UPSTREAM", async () => {
    const bad = { ...FAKE_ANALYSIS_JSON, news_points: undefined };
    const fakeLlm = createFakeLlm(JSON.stringify(bad), JSON.stringify(FAKE_MATCH_JSON));
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/analyze_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { text: "测试" },
    });

    expect(res.statusCode).toBe(503);
    const body = res.json() as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe("BAD_UPSTREAM");
    expect(body.error?.message).toContain("news_points");

    await app.close();
    closeDb(db);
  });

  it("news_points < 3 returns 503 BAD_UPSTREAM", async () => {
    const bad = {
      ...FAKE_ANALYSIS_JSON,
      news_points: [{ point_cn: "a", evidence_cn: "", keywords_cn: [] }],
    };
    const fakeLlm = createFakeLlm(JSON.stringify(bad), JSON.stringify(FAKE_MATCH_JSON));
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/analyze_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { text: "测试" },
    });

    expect(res.statusCode).toBe(503);
    const body = res.json() as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe("BAD_UPSTREAM");
    expect(body.error?.message).toMatch(/news_points|数量不足/);

    await app.close();
    closeDb(db);
  });
});

describe("match_scifi_ai LLM output robustness (fast mode)", () => {
  it("candidates < 8 returns 200 with audit issue (数量不足)", async () => {
    const badCandidates = FAKE_MATCH_JSON.candidates.slice(0, 5);
    const fakeLlm: LlmClient = {
      async complete() {
        return JSON.stringify({ candidates: badCandidates });
      },
    };
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/match_scifi_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { analysis: FAKE_ANALYSIS_JSON, selected_points: ["新闻点一"] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      success?: boolean;
      data?: { candidates?: unknown[]; audit?: { issues?: Array<{ reason?: string }> } };
    };
    expect(body.success).toBe(true);
    expect(body.data?.candidates?.length).toBe(5);
    const issues = body.data?.audit?.issues ?? [];
    expect(issues.some((i) => (i.reason ?? "").includes("数量不足"))).toBe(true);

    await app.close();
    closeDb(db);
  });

  it("mapping_cn empty returns 200 with audit blocker issue", async () => {
    const bad = {
      candidates: FAKE_MATCH_JSON.candidates.map((m, i) =>
        i === 0 ? { ...m, mapping_cn: "" } : m,
      ),
    };
    const fakeLlm: LlmClient = {
      async complete() {
        return JSON.stringify(bad);
      },
    };
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/match_scifi_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { analysis: FAKE_ANALYSIS_JSON, selected_points: ["新闻点一"] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      success?: boolean;
      data?: {
        audit?: { pass?: boolean; issues?: Array<{ path?: string; severity?: string }> };
      };
    };
    expect(body.success).toBe(true);
    const issues = body.data?.audit?.issues ?? [];
    expect(issues.some((i) => i.path?.includes("mapping_cn") && i.severity === "blocker")).toBe(
      true,
    );
    expect(body.data?.audit?.pass).toBe(false);

    await app.close();
    closeDb(db);
  });
});
