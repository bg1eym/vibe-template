import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";

describe("openapi routes", () => {
  it("serves /openapi.json", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({ method: "GET", url: "/openapi.json" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openapi).toBeDefined();
    expect(body.paths).toBeDefined();

    await app.close();
    closeDb(db);
  });

  it("serves /docs html", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({ method: "GET", url: "/docs" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");

    await app.close();
    closeDb(db);
  });
});
