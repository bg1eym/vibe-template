/**
 * match_scifi_ai pipeline 测试：
 * 1. Fast mode: candidates >= 20, recommended_for_ui >= 12, llm_calls == 1
 * 2. Rerank: returns matches >= 8 with audit scores
 * 3. Expand: adds new candidates
 * 4. Pipeline metadata in response
 */
import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import type { LlmClient } from "../src/lib/llmClient.js";
import type {
  MatchCandidate,
  AuditedCandidate,
  AuditSummary,
  PipelineInfo,
} from "../src/services/matchScifiAiService.js";

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

describe("match_scifi_ai pipeline: fast mode", () => {
  it("fake provider returns >= 20 candidates, >= 12 recommended, pipeline.llm_calls == 1", async () => {
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
      const body = res.json() as {
        success?: boolean;
        data?: {
          candidates?: MatchCandidate[];
          recommended_for_ui?: MatchCandidate[];
          audit?: AuditSummary;
          pipeline?: PipelineInfo;
        };
      };
      expect(body.success).toBe(true);
      expect(body.data?.candidates?.length).toBeGreaterThanOrEqual(20);
      expect(body.data?.recommended_for_ui?.length).toBeGreaterThanOrEqual(12);
      expect(body.data?.pipeline?.mode).toBe("fast");
      expect(body.data?.pipeline?.llm_calls).toBe(1);

      await app.close();
      closeDb(db);
    } finally {
      if (prev !== undefined) process.env.LLM_PROVIDER = prev;
      else delete process.env.LLM_PROVIDER;
    }
  });

  it("only 1 LLM call is made (no auto-audit or auto-expand)", async () => {
    let callCount = 0;
    const fakeLlm: LlmClient = {
      async complete() {
        callCount++;
        return JSON.stringify({
          candidates: Array.from({ length: 20 }, (_, i) => ({
            source_id: "Dune",
            work_cn: "沙丘",
            scene_cn: "角色保罗在沙漠中训练" + "描述".repeat(30),
            mapping_cn: "新闻映射内容机制一" + "对照".repeat(30),
            why_this_is_relevant_cn: "因为机制同构" + "解释".repeat(30),
            confidence: 0.8 + i * 0.01,
          })),
        });
      },
    };

    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: fakeLlm });

    await app.inject({
      method: "POST",
      url: "/match_scifi_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { analysis: FAKE_ANALYSIS, selected_points: ["新闻点一"] },
    });

    expect(callCount).toBe(1);

    await app.close();
    closeDb(db);
  });
});

describe("match_scifi_ai_rerank: audit + curate", () => {
  it("returns matches >= 8 with audit scores and diversity", async () => {
    const prev = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = "fake";
    try {
      const db = openDb(":memory:");
      migrate(db);
      const app = buildApp({ db });

      // First get candidates from fast mode
      const genRes = await app.inject({
        method: "POST",
        url: "/match_scifi_ai",
        headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
        payload: { analysis: FAKE_ANALYSIS, selected_points: ["新闻点一"] },
      });
      const genBody = genRes.json() as {
        data?: { candidates?: MatchCandidate[] };
      };
      const candidates = genBody.data?.candidates ?? [];

      // Now rerank
      const res = await app.inject({
        method: "POST",
        url: "/match_scifi_ai_rerank",
        headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
        payload: { candidates, analysis: FAKE_ANALYSIS },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        success?: boolean;
        data?: {
          matches?: AuditedCandidate[];
          audit?: AuditSummary;
          pipeline?: PipelineInfo;
        };
      };
      expect(body.success).toBe(true);
      expect(body.data?.matches?.length).toBeGreaterThanOrEqual(8);
      expect(body.data?.pipeline?.mode).toBe("rerank");
      expect(body.data?.pipeline?.llm_calls).toBe(1);

      // Check audit scores exist
      const first = body.data?.matches?.[0];
      expect(first?.audit).toBeDefined();
      expect(typeof first?.audit?.score?.relevance).toBe("number");
      expect(typeof first?.audit?.total).toBe("number");
      expect(["keep", "maybe", "reject"]).toContain(first?.audit?.verdict);

      // Check audit summary
      expect(body.data?.audit?.keep_count).toBeDefined();
      expect(body.data?.audit?.avg_relevance).toBeDefined();

      // Check diversity: no work appears > 2 times
      const workCounts = new Map<string, number>();
      for (const m of body.data?.matches ?? []) {
        const key = m.source?.work_cn || "";
        workCounts.set(key, (workCounts.get(key) || 0) + 1);
      }
      for (const [, count] of workCounts) {
        expect(count).toBeLessThanOrEqual(2);
      }

      await app.close();
      closeDb(db);
    } finally {
      if (prev !== undefined) process.env.LLM_PROVIDER = prev;
      else delete process.env.LLM_PROVIDER;
    }
  });
});

describe("match_scifi_ai_expand: add new candidates", () => {
  it("returns merged candidates with more items", async () => {
    const prev = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = "fake";
    try {
      const db = openDb(":memory:");
      migrate(db);
      const app = buildApp({ db });

      // Get initial candidates
      const genRes = await app.inject({
        method: "POST",
        url: "/match_scifi_ai",
        headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
        payload: { analysis: FAKE_ANALYSIS, selected_points: ["新闻点一"] },
      });
      const genBody = genRes.json() as {
        data?: { candidates?: MatchCandidate[] };
      };
      const initialCount = genBody.data?.candidates?.length ?? 0;

      // Expand
      const res = await app.inject({
        method: "POST",
        url: "/match_scifi_ai_expand",
        headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
        payload: {
          analysis: FAKE_ANALYSIS,
          selected_points: ["新闻点一"],
          existing_candidates: genBody.data?.candidates ?? [],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        success?: boolean;
        data?: {
          candidates?: MatchCandidate[];
          recommended_for_ui?: MatchCandidate[];
          pipeline?: PipelineInfo;
        };
      };
      expect(body.success).toBe(true);
      expect(body.data?.candidates?.length).toBeGreaterThan(initialCount);
      expect(body.data?.pipeline?.mode).toBe("expand");
      expect(body.data?.pipeline?.llm_calls).toBe(1);

      await app.close();
      closeDb(db);
    } finally {
      if (prev !== undefined) process.env.LLM_PROVIDER = prev;
      else delete process.env.LLM_PROVIDER;
    }
  });
});
