/**
 * match_scifi_ai 质量审稿测试：质量问题不阻断，返回 200 + audit issues。
 * Fast mode: 1 LLM call, returns candidates + recommended_for_ui.
 */
import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import type { LlmClient } from "../src/lib/llmClient.js";
import type { AuditIssue, MatchCandidate } from "../src/services/matchScifiAiService.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CATALOG = JSON.parse(
  readFileSync(join(process.cwd(), "data", "scifi_catalog.json"), "utf-8"),
) as Array<{ title: string; hooks: string[] }>;

const FAKE_ANALYSIS = {
  news_points: [
    { point_cn: "新闻点一：某政策影响", evidence_cn: "证据", keywords_cn: ["政策", "影响"] },
    { point_cn: "新闻点二：技术突破", evidence_cn: "证据", keywords_cn: ["技术"] },
    { point_cn: "新闻点三：社会反响", evidence_cn: "证据", keywords_cn: ["社会"] },
  ],
  mechanisms: [{ id: "m1", name_cn: "机制一", rationale_cn: "理由" }],
  claims: [],
  questions: ["q1", "q2", "q3", "q4", "q5", "q6"],
  search_queries: [],
  confidence: 0.9,
};

const SCENE_GOOD =
  "角色：保罗。组织：弗雷曼人。事件：沙漠中接受训练、饮用生命之水完成蜕变。转折：成为预言中的救世主。决定：承担使命。训练贯穿全篇，改变星球权力格局。";
const MAPPING_GOOD =
  "新闻点一关于政策影响，与沙丘中厄拉科斯星球的香料控制权争夺形成映射，机制一体现在权力委托与资源垄断的相似性，符合机制同构";
const WHY_GOOD =
  "因为权力委托机制在现实政策与科幻叙事中具有同构性，因此沙丘中的香料政治能够映射新闻中的政策博弈，机制层面的反馈循环导致相似的权力集中";

function makeGoodMatch(source_id: string, work_cn: string, author: string, quote_en?: string) {
  return {
    source_id,
    work_cn,
    author,
    scene_cn: SCENE_GOOD,
    mapping_cn: MAPPING_GOOD,
    why_this_is_relevant_cn: WHY_GOOD,
    quote_en,
    confidence: 0.9,
  };
}

function createFakeLlm(matchResponse: string): LlmClient {
  return {
    async complete() {
      return matchResponse;
    },
  };
}

type FastBody = {
  success?: boolean;
  data?: {
    candidates?: MatchCandidate[];
    recommended_for_ui?: MatchCandidate[];
    audit?: { pass?: boolean; issues?: AuditIssue[] };
    pipeline?: { mode?: string; llm_calls?: number };
  };
};

describe("match_scifi_ai quality audit (warn, not block)", () => {
  it("scene_cn too short → 200 + audit issue with scene_cn 长度不足", async () => {
    const bad = {
      candidates: Array.from({ length: 8 }, (_, i) =>
        makeGoodMatch("Dune", "沙丘", "Frank Herbert", i === 0 ? "Spice extends life" : undefined),
      ).map((m, i) => (i === 0 ? { ...m, scene_cn: "沙漠星球的政治博弈" } : m)),
    };
    const fakeLlm = createFakeLlm(JSON.stringify(bad));
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/match_scifi_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { analysis: FAKE_ANALYSIS, selected_points: ["新闻点一"] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as FastBody;
    expect(body.success).toBe(true);
    const issues = body.data?.audit?.issues ?? [];
    expect(issues.some((i) => i.path.includes("scene_cn") && i.reason.includes("长度不足"))).toBe(
      true,
    );

    await app.close();
    closeDb(db);
  });

  it("mapping_cn missing mechanism name → 200 + audit issue with 须含机制名", async () => {
    const bad = {
      candidates: Array.from({ length: 8 }, () =>
        makeGoodMatch("Dune", "沙丘", "Frank Herbert"),
      ).map((m, i) =>
        i === 0
          ? {
              ...m,
              mapping_cn:
                "与新闻中的权力斗争映射，没有具体机制名，仅描述表面现象" + "的".repeat(40),
            }
          : m,
      ),
    };
    const fakeLlm = createFakeLlm(JSON.stringify(bad));
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/match_scifi_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { analysis: FAKE_ANALYSIS, selected_points: ["新闻点一"] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as FastBody;
    expect(body.success).toBe(true);
    const issues = body.data?.audit?.issues ?? [];
    expect(issues.some((i) => i.path.includes("mapping_cn") && i.reason.includes("机制名"))).toBe(
      true,
    );

    await app.close();
    closeDb(db);
  });

  it("Chinese fields containing ASCII letters → 200 + audit issue with 英文字母", async () => {
    const bad = {
      candidates: Array.from({ length: 8 }, () =>
        makeGoodMatch("Dune", "沙丘", "Frank Herbert"),
      ).map((m, i) =>
        i === 0 ? { ...m, why_this_is_relevant_cn: WHY_GOOD + "，涉及AI和Matrix的叙事" } : m,
      ),
    };
    const fakeLlm = createFakeLlm(JSON.stringify(bad));
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/match_scifi_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { analysis: FAKE_ANALYSIS, selected_points: ["新闻点一"] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as FastBody;
    expect(body.success).toBe(true);
    const issues = body.data?.audit?.issues ?? [];
    expect(
      issues.some((i) => i.path.includes("why_this_is_relevant_cn") && i.reason.includes("英文")),
    ).toBe(true);

    await app.close();
    closeDb(db);
  });

  it("quote_en not from catalog hooks → 200 + audit issue (warn)", async () => {
    const dune = CATALOG.find((c) => c.title === "Dune");
    const bad = {
      candidates: Array.from({ length: 8 }, (_, i) =>
        makeGoodMatch(
          "Dune",
          "沙丘",
          "Frank Herbert",
          i === 0 ? "The spice must flow." : undefined,
        ),
      ),
    };
    expect(dune?.hooks).not.toContain("The spice must flow.");
    const fakeLlm = createFakeLlm(JSON.stringify(bad));
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/match_scifi_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { analysis: FAKE_ANALYSIS, selected_points: ["新闻点一"] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as FastBody;
    expect(body.success).toBe(true);
    const issues = body.data?.audit?.issues ?? [];
    expect(issues.some((i) => i.path.includes("quote_en"))).toBe(true);

    await app.close();
    closeDb(db);
  });
});

describe("match_scifi_ai quality accept", () => {
  it("accepts good payload with 6+ candidates, source_id in catalog, quote_en from hooks", async () => {
    const dune = CATALOG.find((c) => c.title === "Dune");
    const validQuote = dune?.hooks?.[0] ?? "Spice extends life";
    const good = {
      candidates: [
        makeGoodMatch("Dune", "沙丘", "Frank Herbert", validQuote),
        makeGoodMatch("1984", "一九八四", "George Orwell"),
        makeGoodMatch("Neuromancer", "神经漫游者", "William Gibson"),
        makeGoodMatch("The Martian", "火星救援", "Andy Weir"),
        makeGoodMatch("Blade Runner", "银翼杀手", "Philip K. Dick"),
        makeGoodMatch("Foundation", "基地", "Isaac Asimov"),
        makeGoodMatch("The Time Machine", "时间机器", "H.G. Wells"),
        makeGoodMatch("Ender's Game", "安德的游戏", "Orson Scott Card"),
      ],
    };
    const fakeLlm = createFakeLlm(JSON.stringify(good));
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/match_scifi_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { analysis: FAKE_ANALYSIS, selected_points: ["新闻点一"] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as FastBody;
    expect(body.success).toBe(true);
    expect(body.data?.candidates?.length).toBeGreaterThanOrEqual(6);
    expect(body.data?.audit?.pass).toBe(true);
    const first = body.data?.candidates?.[0];
    expect(CATALOG.some((c) => c.title === first?.source?.source_id)).toBe(true);

    await app.close();
    closeDb(db);
  });
});

describe("match_scifi_ai integration with fake provider", () => {
  it("LLM_PROVIDER=fake returns catalog-grounded payload that passes audit", async () => {
    const prev = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = "fake";
    try {
      const db = openDb(":memory:");
      migrate(db);
      const app = buildApp({ db });

      const res = await app.inject({
        method: "POST",
        url: "/match_scifi_ai",
        headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
        payload: { analysis: FAKE_ANALYSIS, selected_points: ["新闻点一"] },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as FastBody;
      expect(body.success).toBe(true);
      const candidates = body.data?.candidates ?? [];
      expect(candidates.length).toBeGreaterThanOrEqual(6);
      for (const m of candidates) {
        expect(CATALOG.some((c) => c.title === m.source?.source_id)).toBe(true);
      }

      await app.close();
      closeDb(db);
    } finally {
      if (prev !== undefined) process.env.LLM_PROVIDER = prev;
      else delete process.env.LLM_PROVIDER;
    }
  });
});
