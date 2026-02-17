/**
 * Assets route headers: content-type, cache-control.
 * Ensures stable, cacheable responses for JS/CSS.
 */
import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";

describe("assets headers", () => {
  it("GET /assets/ui.css returns content-type text/css; charset=utf-8", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({ method: "GET", url: "/assets/ui.css" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/css; charset=utf-8");

    await app.close();
    closeDb(db);
  });

  it("GET /assets/ui.css returns cache-control header", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({ method: "GET", url: "/assets/ui.css" });

    expect(res.statusCode).toBe(200);
    const cc = res.headers["cache-control"];
    expect(cc).toBeDefined();
    expect(cc).toContain("max-age");
    expect(cc).toContain("public");

    await app.close();
    closeDb(db);
  });
});
