/**
 * Studio端到端冒烟测试：验证 analyze_ai → match_scifi_ai → rerank 完整流程
 * 确保 API 不会 "failed to fetch"（连接断开/crash/无响应）
 */
import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";

describe("studio smoke: full match pipeline via inject", () => {
  it("analyze_ai → match_scifi_ai → rerank all return 200 with x-req-id", async () => {
    const prev = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = "fake";
    try {
      const db = openDb(":memory:");
      migrate(db);
      const app = buildApp({ db });

      // Step 1: analyze_ai
      const analyzeRes = await app.inject({
        method: "POST",
        url: "/analyze_ai",
        headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
        payload: { text: "张文宏反对把AI引入医院病历系统，因为医生需要训练专业诊断能力。" },
      });

      expect(analyzeRes.statusCode).toBe(200);
      expect(analyzeRes.headers["x-req-id"]).toBeDefined();
      const analyzeBody = analyzeRes.json() as {
        success: boolean;
        data: { analysis: Record<string, unknown> };
      };
      expect(analyzeBody.success).toBe(true);
      expect(analyzeBody.data.analysis).toBeDefined();

      const analysis = analyzeBody.data.analysis;

      // Step 2: match_scifi_ai (FAST mode)
      const matchRes = await app.inject({
        method: "POST",
        url: "/match_scifi_ai",
        headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
        payload: { analysis, selected_points: ["新闻点一"] },
      });

      expect(matchRes.statusCode).toBe(200);
      expect(matchRes.headers["x-req-id"]).toBeDefined();
      const matchBody = matchRes.json() as {
        success: boolean;
        data: {
          candidates: unknown[];
          recommended_for_ui: unknown[];
          pipeline: { mode: string; llm_calls: number };
        };
      };
      expect(matchBody.success).toBe(true);
      expect(matchBody.data.recommended_for_ui.length).toBeGreaterThanOrEqual(12);
      expect(matchBody.data.pipeline.llm_calls).toBe(1);

      // Step 3: rerank
      const rerankRes = await app.inject({
        method: "POST",
        url: "/match_scifi_ai_rerank",
        headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
        payload: { candidates: matchBody.data.candidates, analysis },
      });

      expect(rerankRes.statusCode).toBe(200);
      expect(rerankRes.headers["x-req-id"]).toBeDefined();
      const rerankBody = rerankRes.json() as {
        success: boolean;
        data: { matches: unknown[] };
      };
      expect(rerankBody.success).toBe(true);
      expect(rerankBody.data.matches.length).toBeGreaterThanOrEqual(8);

      await app.close();
      closeDb(db);
    } finally {
      if (prev !== undefined) process.env.LLM_PROVIDER = prev;
      else delete process.env.LLM_PROVIDER;
    }
  });

  it("missing auth returns 401 JSON with req_id (not connection reset)", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({
      method: "POST",
      url: "/match_scifi_ai",
      headers: { "Content-Type": "application/json" },
      payload: { analysis: {}, selected_points: [] },
    });

    expect(res.statusCode).toBe(401);
    expect(res.headers["x-req-id"]).toBeDefined();
    const body = res.json() as { success: boolean; error: { code: string }; req_id: string };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.req_id).toBeDefined();

    await app.close();
    closeDb(db);
  });

  it("no LLM configured returns 503 JSON with req_id (not connection reset)", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db, llmClient: null });

    const res = await app.inject({
      method: "POST",
      url: "/match_scifi_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { analysis: {}, selected_points: [] },
    });

    expect(res.statusCode).toBe(503);
    expect(res.headers["x-req-id"]).toBeDefined();
    const body = res.json() as { success: boolean; req_id: string };
    expect(body.success).toBe(false);
    expect(body.req_id).toBeDefined();

    await app.close();
    closeDb(db);
  });

  it("invalid body returns 400 JSON with req_id (not connection reset)", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({
      method: "POST",
      url: "/match_scifi_ai",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
      payload: { wrong_field: true },
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers["x-req-id"]).toBeDefined();
    const body = res.json() as { success: boolean; req_id: string };
    expect(body.success).toBe(false);
    expect(body.req_id).toBeDefined();

    await app.close();
    closeDb(db);
  });
});
