import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { createUser } from "../src/services/itemService.js";
import { bearerTokenForUser } from "../src/lib/auth.js";

function hasChinese(s: string): boolean {
  return /[\u4e00-\u9fff，。、；：？！]/.test(s);
}

function englishRatio(s: string): number {
  const en = (s.match(/[a-zA-Z]/g) || []).length;
  const total = s.length || 1;
  return en / total;
}

describe("analyze routes", () => {
  it("returns 401 when authorization is missing", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({
      method: "POST",
      url: "/analyze",
      payload: { text: "space and time travel" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED", message: "missing authorization" },
    });

    await app.close();
    closeDb(db);
  });

  it("returns recommendedTracks with length >= 2", async () => {
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
    expect(body.data.recommendedTracks).toBeDefined();
    expect(Array.isArray(body.data.recommendedTracks)).toBe(true);
    expect(body.data.recommendedTracks.length).toBeGreaterThanOrEqual(2);

    const track = body.data.recommendedTracks[0];
    expect(track.trackId).toBeDefined();
    expect(track.title).toBeDefined();
    expect(hasChinese(track.title)).toBe(true);
    expect(track.confidence).toBeDefined();
    expect(track.categories).toBeDefined();
    expect(track.mechanisms).toBeDefined();
    expect(track.scifiCandidates).toBeDefined();
    expect(track.whyThisTrack).toBeDefined();
    expect(hasChinese(track.whyThisTrack)).toBe(true);

    await app.close();
    closeDb(db);
  });

  it("张文宏新闻 hits mechanism automation deskilling or epistemic dependence", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "a@example.com");
    const token = bearerTokenForUser(user.id);

    const app = buildApp({ db });

    const res = await app.inject({
      method: "POST",
      url: "/analyze",
      headers: { authorization: `Bearer ${token}` },
      payload: { text: "张文宏新闻：专家解读疫情" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.mechanismMatches.length).toBeGreaterThanOrEqual(2);
    expect(body.data.recommendedTracks.length).toBeGreaterThanOrEqual(2);

    const mechanisms = body.data.mechanismMatches.map((m: { mechanism?: string }) => m.mechanism);
    const hit =
      mechanisms.includes("automation deskilling") || mechanisms.includes("epistemic dependence");
    expect(hit).toBe(true);

    await app.close();
    closeDb(db);
  });
});

describe("expand routes", () => {
  it("returns 401 when authorization is missing", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({
      method: "POST",
      url: "/expand",
      payload: {
        text: "space and time travel",
        selectedTrackId: "track-1",
      },
    });
    expect(res.statusCode).toBe(401);

    await app.close();
    closeDb(db);
  });

  it("returns plotSupportCards >= 3, Chinese-only in summary/mapping/question", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "a@example.com");
    const token = bearerTokenForUser(user.id);

    const app = buildApp({ db });

    const res = await app.inject({
      method: "POST",
      url: "/expand",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        text: "space travel and robots in the future",
        selectedTrackId: "track-1",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.plotSupportCards).toBeDefined();
    expect(Array.isArray(body.data.plotSupportCards)).toBe(true);
    expect(body.data.plotSupportCards.length).toBeGreaterThanOrEqual(3);

    for (const card of body.data.plotSupportCards) {
      expect(card.scene_title_cn).toBeDefined();
      expect(card.plot_summary_cn).toBeDefined();
      expect(card.mapping_cn).toBeDefined();
      expect(card.podcast_question_cn).toBeDefined();
      expect(hasChinese(card.plot_summary_cn)).toBe(true);
      expect(hasChinese(card.mapping_cn)).toBe(true);
      expect(hasChinese(card.podcast_question_cn)).toBe(true);
      expect(englishRatio(card.plot_summary_cn)).toBeLessThanOrEqual(0.1);
      expect(englishRatio(card.mapping_cn)).toBeLessThanOrEqual(0.1);
      expect(englishRatio(card.podcast_question_cn)).toBeLessThanOrEqual(0.1);
    }

    await app.close();
    closeDb(db);
  });
});
