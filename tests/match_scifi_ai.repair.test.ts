/**
 * /repair_match_scifi_ai 路由测试：定向修补 audit issues。
 */
import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import type { LlmClient } from "../src/lib/llmClient.js";
import type { AuditIssue } from "../src/services/matchScifiAiService.js";

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
    work_en: source_id,
    author,
    scene_cn: SCENE_GOOD,
    mapping_cn: MAPPING_GOOD,
    why_this_is_relevant_cn: WHY_GOOD,
    quote_en,
    confidence: 0.9,
  };
}

const GOOD_DRAFT = {
  matches: [
    makeMatch("Dune", "沙丘", "Frank Herbert", "Spice extends life"),
    makeMatch("1984", "一九八四", "George Orwell"),
    makeMatch("Neuromancer", "神经漫游者", "William Gibson"),
    makeMatch("The Martian", "火星救援", "Andy Weir"),
    makeMatch("Blade Runner", "银翼杀手", "Philip K. Dick"),
    makeMatch("Foundation", "基地", "Isaac Asimov"),
    makeMatch("The Time Machine", "时间机器", "H.G. Wells"),
    makeMatch("Ender's Game", "安德的游戏", "Orson Scott Card"),
  ],
  evidenceChain: { selected_points: ["新闻点一"], mechanisms: ["机制一"], works: [] },
  podcastOutline: { opening_cn: "开场", framing_cn: [], closing_cn: "收尾" },
};

function createFakeLlm(repairResponse: string): LlmClient {
  return {
    async complete() {
      return repairResponse;
    },
  };
}

type AuditBody = {
  success?: boolean;
  data?: { matches?: unknown[]; audit?: { pass?: boolean; issues?: AuditIssue[] } };
};

describe("POST /repair_match_scifi_ai", () => {
  it("接收 draft + issues 返回修复后的结果 + 新 audit", async () => {
    const fakeLlm = createFakeLlm(JSON.stringify(GOOD_DRAFT));
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const issues: AuditIssue[] = [
      {
        path: "matches[0].mapping_cn",
        severity: "warn",
        reason: "须含机制名",
        fix_instruction: "添加机制名",
      },
    ];

    const res = await app.inject({
      method: "POST",
      url: "/repair_match_scifi_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { draft: GOOD_DRAFT, issues, analysis: FAKE_ANALYSIS },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as AuditBody;
    expect(body.success).toBe(true);
    expect(body.data?.matches?.length).toBeGreaterThanOrEqual(1);
    expect(body.data?.audit).toBeDefined();

    await app.close();
    closeDb(db);
  });

  it("LLM 返回无法解析 JSON → 503", async () => {
    const fakeLlm = createFakeLlm("这不是 JSON");
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const issues: AuditIssue[] = [
      {
        path: "matches[0].source_id",
        severity: "warn",
        reason: "不在候选列表",
        fix_instruction: "替换",
      },
    ];

    const res = await app.inject({
      method: "POST",
      url: "/repair_match_scifi_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { draft: GOOD_DRAFT, issues, analysis: FAKE_ANALYSIS },
    });

    expect(res.statusCode).toBe(503);
    const body = res.json() as { error?: { code?: string } };
    expect(body.error?.code).toBe("BAD_UPSTREAM");

    await app.close();
    closeDb(db);
  });

  it("需要 auth → 无 Bearer 返回 401", async () => {
    const fakeLlm = createFakeLlm(JSON.stringify(GOOD_DRAFT));
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    const res = await app.inject({
      method: "POST",
      url: "/repair_match_scifi_ai",
      headers: { "Content-Type": "application/json" },
      payload: { draft: GOOD_DRAFT, issues: [], analysis: FAKE_ANALYSIS },
    });

    expect(res.statusCode).toBe(401);

    await app.close();
    closeDb(db);
  });
});
