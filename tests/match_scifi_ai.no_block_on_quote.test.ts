/**
 * match_scifi_ai: quote_en 不在 hooks 时不阻断，返回 200 + audit warn。
 * Fast mode: 1 LLM call only.
 */
import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import type { LlmClient } from "../src/lib/llmClient.js";
import type { AuditIssue, MatchCandidate } from "../src/services/matchScifiAiService.js";

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

function makeMatch(source_id: string, work_cn: string, author: string, quote_en?: string) {
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

describe("match_scifi_ai: quote_en 不在 hooks 不阻断", () => {
  it("quote_en 不在 hooks → HTTP 200 + audit.issues 含 quote 警告", async () => {
    const payload = {
      candidates: [
        makeMatch("Dune", "沙丘", "Frank Herbert", "The spice must flow."),
        makeMatch("1984", "一九八四", "George Orwell"),
        makeMatch("Neuromancer", "神经漫游者", "William Gibson"),
        makeMatch("The Martian", "火星救援", "Andy Weir"),
        makeMatch("Blade Runner", "银翼杀手", "Philip K. Dick"),
        makeMatch("Foundation", "基地", "Isaac Asimov"),
        makeMatch("The Time Machine", "时间机器", "H.G. Wells"),
        makeMatch("Ender's Game", "安德的游戏", "Orson Scott Card"),
      ],
    };
    const fakeLlm = createFakeLlm(JSON.stringify(payload));
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
    const body = res.json() as {
      success?: boolean;
      data?: {
        candidates?: MatchCandidate[];
        audit?: { pass?: boolean; issues?: AuditIssue[] };
      };
    };
    expect(body.success).toBe(true);
    expect(body.data?.candidates?.length).toBeGreaterThanOrEqual(8);

    const quoteIssues = (body.data?.audit?.issues ?? []).filter((i) => i.path.includes("quote_en"));
    expect(quoteIssues.length).toBeGreaterThanOrEqual(1);
    expect(quoteIssues[0].severity).toBe("warn");
    expect(quoteIssues[0].reason).toMatch(/quote.*非原文|人工核对/);

    await app.close();
    closeDb(db);
  });

  it("quote_en 在 hooks 内 → 无 quote 警告", async () => {
    const payload = {
      candidates: [
        makeMatch("Dune", "沙丘", "Frank Herbert", "Spice extends life"),
        makeMatch("1984", "一九八四", "George Orwell"),
        makeMatch("Neuromancer", "神经漫游者", "William Gibson"),
        makeMatch("The Martian", "火星救援", "Andy Weir"),
        makeMatch("Blade Runner", "银翼杀手", "Philip K. Dick"),
        makeMatch("Foundation", "基地", "Isaac Asimov"),
        makeMatch("The Time Machine", "时间机器", "H.G. Wells"),
        makeMatch("Ender's Game", "安德的游戏", "Orson Scott Card"),
      ],
    };
    const fakeLlm = createFakeLlm(JSON.stringify(payload));
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
    const body = res.json() as {
      success?: boolean;
      data?: { audit?: { issues?: AuditIssue[] } };
    };
    const quoteIssues = (body.data?.audit?.issues ?? []).filter((i) => i.path.includes("quote_en"));
    expect(quoteIssues.length).toBe(0);

    await app.close();
    closeDb(db);
  });
});
