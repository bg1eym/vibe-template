/**
 * match_scifi_ai scene_markers 审稿：scene_cn 缺剧情元素 → 200 + audit issue。
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

const SCENE_BAD =
  "探讨了权力与人性，反映社会现实，揭示制度困境，警示人类未来，具有深刻意义，引发观众思考与共鸣，值得反复品味与反思，这是一部经典";
const SCENE_GOOD =
  "角色：保罗。组织：弗雷曼人。事件：沙漠中接受训练、饮用生命之水完成蜕变。转折：成为预言中的救世主。决定：承担使命。训练贯穿全篇，改变星球权力格局。";

const MAPPING_GOOD =
  "新闻点一关于政策影响，与沙丘中厄拉科斯星球的香料控制权争夺形成映射，机制一体现在权力委托与资源垄断的相似性，符合机制同构";
const WHY_GOOD =
  "因为权力委托机制在现实政策与科幻叙事中具有同构性，因此沙丘中的香料政治能够映射新闻中的政策博弈，机制层面的反馈循环导致相似的权力集中";

function makeMatch(
  source_id: string,
  work_cn: string,
  author: string,
  scene_cn: string,
  quote_en?: string,
) {
  return {
    source_id,
    work_cn,
    author,
    scene_cn,
    mapping_cn: MAPPING_GOOD,
    why_this_is_relevant_cn: WHY_GOOD,
    quote_en,
    confidence: 0.9,
  };
}

const FULL_PAYLOAD = (scene_cn: string) => ({
  candidates: [
    makeMatch("Dune", "沙丘", "Frank Herbert", scene_cn, "Spice extends life"),
    makeMatch("1984", "一九八四", "George Orwell", scene_cn),
    makeMatch("Neuromancer", "神经漫游者", "William Gibson", scene_cn),
    makeMatch("The Martian", "火星救援", "Andy Weir", scene_cn),
    makeMatch("Blade Runner", "银翼杀手", "Philip K. Dick", scene_cn),
    makeMatch("Foundation", "基地", "Isaac Asimov", scene_cn),
    makeMatch("The Time Machine", "时间机器", "H.G. Wells", scene_cn),
    makeMatch("Ender's Game", "安德的游戏", "Orson Scott Card", scene_cn),
  ],
});

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
  };
};

describe("match_scifi_ai scene_markers", () => {
  it("scene_cn without markers (探讨/反映) → 200 + audit issue with 须含剧情元素", async () => {
    const badPayload = FULL_PAYLOAD(SCENE_BAD);
    const fakeLlm = createFakeLlm(JSON.stringify(badPayload));

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
    expect(issues.some((i) => i.path.includes("scene_cn") && i.reason.includes("剧情元素"))).toBe(
      true,
    );

    await app.close();
    closeDb(db);
  });

  it("scene_cn with markers (角色/事件/转折/决定/训练) → 200 + audit.pass=true", async () => {
    const goodPayload = FULL_PAYLOAD(SCENE_GOOD);
    const fakeLlm = createFakeLlm(JSON.stringify(goodPayload));

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
    expect(body.data?.candidates?.length).toBeGreaterThanOrEqual(8);
    expect(body.data?.audit?.pass).toBe(true);
    const first = body.data?.candidates?.[0];
    expect(first?.scene_cn).toMatch(/角色|组织|系统|事件|转折|决定|事故|审判|协议|训练|考核/);
    expect(first?.scene_cn?.length).toBeGreaterThanOrEqual(60);

    await app.close();
    closeDb(db);
  });
});
