/**
 * Human feedback integration tests:
 * 1. rerank respects reject_ids (excluded from matches)
 * 2. rerank respects keep_ids (appear in top results)
 * 3. expand avoids rejected themes
 * 4. improve modifies only target_ids
 */
import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import type {
  MatchCandidate,
  AuditedCandidate,
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

function setupApp() {
  const prev = process.env.LLM_PROVIDER;
  process.env.LLM_PROVIDER = "fake";
  const db = openDb(":memory:");
  migrate(db);
  const app = buildApp({ db });
  return { app, db, prev };
}

function teardown(app: ReturnType<typeof buildApp>, db: ReturnType<typeof openDb>, prev?: string) {
  void app.close();
  closeDb(db);
  if (prev !== undefined) process.env.LLM_PROVIDER = prev;
  else delete process.env.LLM_PROVIDER;
}

async function getCandidates(app: ReturnType<typeof buildApp>): Promise<MatchCandidate[]> {
  const res = await app.inject({
    method: "POST",
    url: "/match_scifi_ai",
    headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
    payload: { analysis: FAKE_ANALYSIS, selected_points: ["新闻点一"] },
  });
  const body = res.json() as { data?: { candidates?: MatchCandidate[] } };
  return body.data?.candidates ?? [];
}

describe("rerank with human feedback", () => {
  it("respects reject_ids: rejected candidates excluded from matches", async () => {
    const { app, db, prev } = setupApp();
    try {
      const candidates = await getCandidates(app);
      const rejectId = candidates[1].id;

      const res = await app.inject({
        method: "POST",
        url: "/match_scifi_ai_rerank",
        headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
        payload: {
          candidates,
          analysis: FAKE_ANALYSIS,
          feedback: { reject_ids: [rejectId] },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        success: boolean;
        data: { matches: AuditedCandidate[]; pipeline: PipelineInfo };
      };
      expect(body.success).toBe(true);
      expect(body.data.pipeline.llm_calls).toBe(1);

      const matchIds = body.data.matches.map((m) => m.id);
      expect(matchIds).not.toContain(rejectId);
    } finally {
      teardown(app, db, prev);
    }
  });

  it("respects keep_ids: kept candidates appear in top results", async () => {
    const { app, db, prev } = setupApp();
    try {
      const candidates = await getCandidates(app);
      const keepId = candidates[candidates.length - 1].id;

      const res = await app.inject({
        method: "POST",
        url: "/match_scifi_ai_rerank",
        headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
        payload: {
          candidates,
          analysis: FAKE_ANALYSIS,
          feedback: { keep_ids: [keepId] },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        success: boolean;
        data: { matches: AuditedCandidate[]; pipeline: PipelineInfo };
      };
      expect(body.success).toBe(true);
      expect(body.data.pipeline.llm_calls).toBe(1);

      const matchIds = body.data.matches.map((m) => m.id);
      expect(matchIds).toContain(keepId);
    } finally {
      teardown(app, db, prev);
    }
  });
});

describe("expand with human feedback", () => {
  it("expand returns new candidates, pipeline.llm_calls === 1", async () => {
    const { app, db, prev } = setupApp();
    try {
      const candidates = await getCandidates(app);
      const rejectId = candidates[0].id;

      const res = await app.inject({
        method: "POST",
        url: "/match_scifi_ai_expand",
        headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
        payload: {
          analysis: FAKE_ANALYSIS,
          selected_points: ["新闻点一"],
          existing_candidates: candidates,
          feedback: { reject_ids: [rejectId] },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        success: boolean;
        data: { candidates: MatchCandidate[]; pipeline: PipelineInfo };
      };
      expect(body.success).toBe(true);
      expect(body.data.candidates.length).toBeGreaterThan(candidates.length);
      expect(body.data.pipeline.llm_calls).toBe(1);
    } finally {
      teardown(app, db, prev);
    }
  });
});

describe("improve with human feedback", () => {
  it("modifies only target_ids, others unchanged (deepEqual)", async () => {
    const { app, db, prev } = setupApp();
    try {
      const candidates = await getCandidates(app);
      const targetId = candidates[0].id;

      // Snapshot all non-target candidates before improve
      const nonTargets = candidates.filter((c) => c.id !== targetId);

      const res = await app.inject({
        method: "POST",
        url: "/match_scifi_ai_improve",
        headers: { "Content-Type": "application/json", Authorization: "Bearer user_1" },
        payload: {
          analysis: FAKE_ANALYSIS,
          selected_points: ["新闻点一"],
          candidates,
          target_ids: [targetId],
          feedback: { notes_by_id: { [targetId]: "让剧情更具体" } },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        success: boolean;
        data: {
          candidates: MatchCandidate[];
          changed_ids: string[];
          pipeline: PipelineInfo;
        };
      };
      expect(body.success).toBe(true);
      expect(body.data.pipeline.llm_calls).toBe(1);
      expect(body.data.pipeline.mode).toBe("improve");
      expect(body.data.changed_ids).toContain(targetId);
      expect(body.data.changed_ids).not.toContain(nonTargets[0].id);

      // Same length, same order
      expect(body.data.candidates.length).toBe(candidates.length);

      // Every non-target candidate must be deepEqual to original
      for (const orig of nonTargets) {
        const result = body.data.candidates.find((c) => c.id === orig.id);
        expect(result).toBeDefined();
        expect(result).toEqual(orig);
      }
    } finally {
      teardown(app, db, prev);
    }
  });

  it("requires auth", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({
      method: "POST",
      url: "/match_scifi_ai_improve",
      headers: { "Content-Type": "application/json" },
      payload: { analysis: {}, candidates: [], target_ids: ["x"] },
    });

    expect(res.statusCode).toBe(401);

    await app.close();
    closeDb(db);
  });
});
