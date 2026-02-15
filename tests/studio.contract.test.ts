import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { createUser } from "../src/services/itemService.js";
import { bearerTokenForUser } from "../src/lib/auth.js";

function hasChinese(str: string): boolean {
  return /[\u4e00-\u9fff]/.test(str);
}

describe("studio contract - API layer", () => {
  it("POST /analyze returns podcastOutline and evidenceChain with full structure", async () => {
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

    const o = body.data.podcastOutline;
    expect(o).toBeDefined();
    expect(o.opening_hook).toBeDefined();
    expect(hasChinese(o.opening_hook)).toBe(true);
    expect(o.framing).toBeDefined();
    expect(Array.isArray(o.framing)).toBe(true);
    expect(o.framing.length).toBeGreaterThanOrEqual(2);
    expect(o.debate).toBeDefined();
    expect(o.debate.thesis).toBeDefined();
    expect(o.debate.antithesis).toBeDefined();
    expect(o.debate.synthesis).toBeDefined();
    expect(hasChinese(o.debate.thesis)).toBe(true);
    expect(hasChinese(o.debate.antithesis)).toBe(true);
    expect(hasChinese(o.debate.synthesis)).toBe(true);
    expect(o.analogy_scenarios).toBeDefined();
    expect(Array.isArray(o.analogy_scenarios)).toBe(true);
    expect(o.analogy_scenarios.length).toBeGreaterThanOrEqual(2);
    for (const a of o.analogy_scenarios) {
      expect(hasChinese(a)).toBe(true);
    }
    expect(o.counterexamples).toBeDefined();
    expect(Array.isArray(o.counterexamples)).toBe(true);
    expect(o.counterexamples.length).toBeGreaterThanOrEqual(2);
    expect(o.closing).toBeDefined();

    const ec = body.data.evidenceChain;
    expect(ec).toBeDefined();
    expect(Array.isArray(ec)).toBe(true);
    expect(ec.length).toBeGreaterThanOrEqual(1);
    const first = ec[0];
    expect(first.categories).toBeDefined();
    expect(Array.isArray(first.categories)).toBe(true);
    expect(first.categories.length).toBeGreaterThanOrEqual(1);
    expect(first.mechanisms).toBeDefined();
    expect(Array.isArray(first.mechanisms)).toBe(true);
    expect(first.mechanisms.length).toBeGreaterThanOrEqual(1);
    expect(first.scifiRefs).toBeDefined();
    expect(Array.isArray(first.scifiRefs)).toBe(true);
    expect(first.scifiRefs.length).toBeGreaterThanOrEqual(1);
    const ref = first.scifiRefs[0];
    expect(ref.title_cn).toBeDefined();
    expect(ref.hook_cn).toBeDefined();
    expect(hasChinese(ref.title_cn)).toBe(true);
    expect(hasChinese(ref.hook_cn)).toBe(true);

    await app.close();
    closeDb(db);
  });
});

describe("studio contract - UI layer", () => {
  it("GET /studio returns HTML with tabs and structure for 播客大纲 + 证据链", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({ method: "GET", url: "/studio" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    const html = res.payload;

    expect(html).toContain("剧情支撑");
    expect(html).toContain("播客大纲");
    expect(html).toContain("证据链");

    expect(html).toContain("tab-outline");
    expect(html).toContain("tab-evidence");

    expect(html).toContain("开场");
    expect(html).toContain("框架");
    expect(html).toContain("辩论");
    expect(html).toContain("证据链");
    expect(html).toContain("引用原文");

    await app.close();
    closeDb(db);
  });
});
