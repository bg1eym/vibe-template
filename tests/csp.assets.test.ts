/**
 * CSP 与 assets 路由验收测试。
 * 防止回退：CSP 缺失或字段不全、assets 路由失效。
 */
import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";

const REQUIRED_CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
];

describe("CSP header", () => {
  it("GET /studio returns CSP header with all required directives", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({ method: "GET", url: "/studio" });

    expect(res.statusCode).toBe(200);
    const csp = res.headers["content-security-policy"];
    expect(csp).toBeDefined();
    expect(typeof csp).toBe("string");

    for (const directive of REQUIRED_CSP_DIRECTIVES) {
      expect(csp).toContain(directive);
    }

    await app.close();
    closeDb(db);
  });

  it("GET /ui returns CSP header with all required directives", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({ method: "GET", url: "/ui" });

    expect(res.statusCode).toBe(200);
    const csp = res.headers["content-security-policy"];
    expect(csp).toBeDefined();
    expect(typeof csp).toBe("string");

    for (const directive of REQUIRED_CSP_DIRECTIVES) {
      expect(csp).toContain(directive);
    }

    await app.close();
    closeDb(db);
  });
});

describe("assets route", () => {
  it("GET /assets/studio.js returns 200 and content-type application/javascript", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({ method: "GET", url: "/assets/studio.js" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/javascript");
    expect(res.payload).toBeDefined();
    expect(typeof res.payload).toBe("string");
    expect(res.payload.length).toBeGreaterThan(0);

    await app.close();
    closeDb(db);
  });

  it("GET /assets/ui.js returns 200 and content-type application/javascript", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({ method: "GET", url: "/assets/ui.js" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/javascript");
    expect(res.payload).toBeDefined();
    expect(typeof res.payload).toBe("string");

    await app.close();
    closeDb(db);
  });

  it("GET /assets/studio.css returns 200 and content-type text/css", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({ method: "GET", url: "/assets/studio.css" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/css");
    expect(res.payload).toBeDefined();
    expect(typeof res.payload).toBe("string");
    expect(res.payload.length).toBeGreaterThan(0);

    await app.close();
    closeDb(db);
  });

  it("GET /studio HTML contains link to studio.css", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({ method: "GET", url: "/studio" });

    expect(res.statusCode).toBe(200);
    expect(res.payload).toContain('<link rel="stylesheet" href="/assets/studio.css"');

    await app.close();
    closeDb(db);
  });
});
