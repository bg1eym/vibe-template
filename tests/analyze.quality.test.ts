/**
 * 输出质量测试：防止占位符式输出。
 * 防止回退：若有人缩短文案、用英文占位、或减少 framing/cards 数量，此测试会失败。
 */
import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { createUser } from "../src/services/itemService.js";
import { bearerTokenForUser } from "../src/lib/auth.js";

const hasChinese = (s: string): boolean => /[\u4e00-\u9fff]/.test(s);

describe("analyze.quality - podcastOutline", () => {
  it("framing.length >= 3", async () => {
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
    expect(body.data.podcastOutline.framing.length).toBeGreaterThanOrEqual(3);

    await app.close();
    closeDb(db);
  });
});

describe("analyze.quality - plotSupportCards", () => {
  it("plotSupportCards.length >= 3", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "a@example.com");
    const token = bearerTokenForUser(user.id);
    const app = buildApp({ db });

    const res = await app.inject({
      method: "POST",
      url: "/expand",
      headers: { authorization: `Bearer ${token}` },
      payload: { text: "space travel", selectedTrackId: "track-1" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.plotSupportCards.length).toBeGreaterThanOrEqual(3);

    await app.close();
    closeDb(db);
  });

  it("plot_summary_cn >= 40 chars, mapping_cn >= 30 chars", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "a@example.com");
    const token = bearerTokenForUser(user.id);
    const app = buildApp({ db });

    const res = await app.inject({
      method: "POST",
      url: "/expand",
      headers: { authorization: `Bearer ${token}` },
      payload: { text: "space travel", selectedTrackId: "track-1" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    for (const card of body.data.plotSupportCards) {
      expect(card.plot_summary_cn.length).toBeGreaterThanOrEqual(40);
      expect(card.mapping_cn.length).toBeGreaterThanOrEqual(30);
      expect(card.podcast_question_cn.length).toBeGreaterThanOrEqual(20);
      expect(hasChinese(card.plot_summary_cn)).toBe(true);
      expect(hasChinese(card.mapping_cn)).toBe(true);
      expect(hasChinese(card.podcast_question_cn)).toBe(true);
    }

    await app.close();
    closeDb(db);
  });
});

describe("analyze.quality - evidenceChain", () => {
  it("hook_cn >= 25 chars, all Chinese fields contain Chinese", async () => {
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

    for (const ec of body.data.evidenceChain || []) {
      for (const r of ec.scifiRefs || []) {
        expect(r.hook_cn.length).toBeGreaterThanOrEqual(25);
        expect(hasChinese(r.hook_cn)).toBe(true);
        expect(hasChinese(r.title_cn)).toBe(true);
      }
    }

    await app.close();
    closeDb(db);
  });
});
