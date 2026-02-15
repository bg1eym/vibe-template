/**
 * 证据链可追溯性测试。
 * 防止回退：若有人引入「相关作品」占位、或 plotSupportCards 与 evidenceChain 脱节，此测试会失败。
 */
import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { createUser } from "../src/services/itemService.js";
import { bearerTokenForUser } from "../src/lib/auth.js";

function allEvidenceSourceIds(data: {
  evidenceChain?: Array<{ scifiRefs?: Array<{ source_id?: string }> }>;
}): Set<string> {
  const ids = new Set<string>();
  for (const ec of data.evidenceChain || []) {
    for (const r of ec.scifiRefs || []) {
      if (r.source_id) ids.add(r.source_id);
    }
  }
  return ids;
}

describe("evidence.coherence - analyze", () => {
  it("evidenceChain.scifiRefs.title_cn must come from matched works, not 相关作品", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "a@example.com");
    const token = bearerTokenForUser(user.id);
    const app = buildApp({ db });

    const res = await app.inject({
      method: "POST",
      url: "/analyze",
      headers: { authorization: `Bearer ${token}` },
      payload: { text: "张文宏专家解读疫情，自动化算法替代人工判断" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    const evidenceIds = allEvidenceSourceIds(body.data);

    for (const ec of body.data.evidenceChain || []) {
      for (const r of ec.scifiRefs || []) {
        expect(r.source_id).toBeDefined();
        expect(r.title_cn).not.toBe("相关作品");
        expect(String(r.title_cn).trim().length).toBeGreaterThan(0);
      }
    }

    expect(evidenceIds.size).toBeGreaterThan(0);

    await app.close();
    closeDb(db);
  });

  it("no title_cn may be empty or 相关作品", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "a@example.com");
    const token = bearerTokenForUser(user.id);
    const app = buildApp({ db });

    const res = await app.inject({
      method: "POST",
      url: "/analyze",
      headers: { authorization: `Bearer ${token}` },
      payload: { text: "space travel and robots in the future" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    for (const ec of body.data.evidenceChain || []) {
      for (const r of ec.scifiRefs || []) {
        expect(r.title_cn).toBeDefined();
        expect(r.title_cn).not.toBe("相关作品");
        expect(String(r.title_cn).trim()).not.toBe("");
      }
    }

    await app.close();
    closeDb(db);
  });
});

describe("evidence.coherence - expand", () => {
  it("plotSupportCards must have source_id (stable ref) present in analyze evidenceChain", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "a@example.com");
    const token = bearerTokenForUser(user.id);
    const app = buildApp({ db });
    const text = "space travel and robots in the future";

    const analyzeRes = await app.inject({
      method: "POST",
      url: "/analyze",
      headers: { authorization: `Bearer ${token}` },
      payload: { text },
    });
    expect(analyzeRes.statusCode).toBe(200);
    const analyzeData = analyzeRes.json().data;
    const evidenceSourceIds = allEvidenceSourceIds(analyzeData);

    const expandRes = await app.inject({
      method: "POST",
      url: "/expand",
      headers: { authorization: `Bearer ${token}` },
      payload: { text, selectedTrackId: "track-1" },
    });

    expect(expandRes.statusCode).toBe(200);
    const expandBody = expandRes.json();
    expect(expandBody.success).toBe(true);

    const cards = expandBody.data.plotSupportCards || [];
    expect(cards.length).toBeGreaterThanOrEqual(3);

    for (const card of cards) {
      expect(card.source_id).toBeDefined();
      expect(String(card.source_id).trim()).not.toBe("");
      expect(evidenceSourceIds.has(card.source_id)).toBe(true);
      expect(card.source_title_cn).toBeDefined();
      expect(card.source_title_cn).not.toBe("相关作品");
    }

    await app.close();
    closeDb(db);
  });
});
