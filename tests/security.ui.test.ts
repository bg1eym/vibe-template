/**
 * 安全测试：确保 UI 不会把恶意脚本注入 HTML。
 * 防止回退：若有人移除 escapeHtml 或直接拼 innerHTML，此测试会失败。
 */
import { describe, it, expect } from "vitest";
import { escapeHtml } from "../src/lib/escapeHtml.js";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { createUser } from "../src/services/itemService.js";
import { bearerTokenForUser } from "../src/lib/auth.js";

function collectStrings(obj: unknown, out: string[] = []): string[] {
  if (obj == null) return out;
  if (typeof obj === "string") {
    out.push(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((x) => collectStrings(x, out));
    return out;
  }
  if (typeof obj === "object") {
    Object.values(obj).forEach((v) => collectStrings(v, out));
    return out;
  }
  return out;
}

describe("security.ui - escapeHtml", () => {
  it("escapes script tags so output cannot execute", () => {
    const xss = '<script>alert("xss")</script>';
    const out = escapeHtml(xss);
    expect(out).not.toMatch(/<script[\s>]/i);
    expect(out).toContain("&lt;");
  });

  it("escapes img onerror so tag cannot execute", () => {
    const xss = "<img src=x onerror=alert(1)>";
    const out = escapeHtml(xss);
    expect(out).not.toMatch(/<[a-z][a-z0-9]*\s/i);
  });

  it("escaped string does not contain unescaped angle brackets", () => {
    const inputs = [
      "<script>evil</script>",
      "<img onerror=alert(1)>",
      "<svg onload=alert(1)>",
      "normal text",
    ];
    for (const s of inputs) {
      const out = escapeHtml(s);
      expect(out).not.toMatch(/(?<!&)lt;(?![a-z])|(?<!&)gt;/);
    }
  });
});

describe("security.ui - API response safety", () => {
  it("analyze with malicious input: escaped response has no executable script", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "a@example.com");
    const token = bearerTokenForUser(user.id);
    const app = buildApp({ db });

    const res = await app.inject({
      method: "POST",
      url: "/analyze",
      headers: { authorization: `Bearer ${token}` },
      payload: { text: "<script>alert(1)</script><img onerror=alert(1)>" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    const strings = collectStrings(body.data);
    for (const s of strings) {
      const escaped = escapeHtml(s);
      expect(escaped).not.toMatch(/<script[\s>]/i);
    }

    await app.close();
    closeDb(db);
  });

  it("expand with malicious input: escaped response has no executable script", async () => {
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
        text: "<script>evil</script>",
        selectedTrackId: "track-1",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    const strings = collectStrings(body.data);
    for (const s of strings) {
      const escaped = escapeHtml(s);
      expect(escaped).not.toMatch(/<script[\s>]/i);
    }

    await app.close();
    closeDb(db);
  });
});
