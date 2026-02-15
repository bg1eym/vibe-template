import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { createUser } from "../src/services/itemService.js";
import { bearerTokenForUser } from "../src/lib/auth.js";

describe("items routes", () => {
  it("supports CRUD for owner via Authorization Bearer token", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "a@example.com");
    const token = bearerTokenForUser(user.id);

    const app = buildApp({ db });

    const createRes = await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "t1", content: "c1" }
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.success).toBe(true);
    const itemId = created.data.item.id as string;

    const listRes = await app.inject({
      method: "GET",
      url: "/items",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json();
    expect(list.data.items.length).toBe(1);
    expect(list.data.page.total).toBe(1);
    expect(list.data.page.limit).toBe(20);
    expect(list.data.page.offset).toBe(0);

    const getRes = await app.inject({
      method: "GET",
      url: `/items/${itemId}`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(getRes.statusCode).toBe(200);

    const putRes = await app.inject({
      method: "PUT",
      url: `/items/${itemId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "t1b", content: "c1b" }
    });
    expect(putRes.statusCode).toBe(200);
    expect(putRes.json().data.item.title).toBe("t1b");

    const delRes = await app.inject({
      method: "DELETE",
      url: `/items/${itemId}`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().data.deleted).toBe(true);

    await app.close();
    closeDb(db);
  });

  it("returns UNAUTHORIZED when authorization is missing", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const app = buildApp({ db });

    const res = await app.inject({ method: "GET", url: "/items" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "missing authorization" }
    });

    await app.close();
    closeDb(db);
  });

  it("returns BAD_REQUEST for invalid body (schema validation)", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "a2@example.com");
    const token = bearerTokenForUser(user.id);

    const app = buildApp({ db });

    const res = await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "", content: "" }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      success: false,
      error: { code: "BAD_REQUEST", message: "invalid request" }
    });

    await app.close();
    closeDb(db);
  });

  it("paginates GET /items with limit/offset", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "p@example.com");
    const token = bearerTokenForUser(user.id);

    const app = buildApp({ db });

    const i1 = (await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "t1", content: "c1" }
    })).json().data.item.id as string;

    const i2 = (await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "t2", content: "c2" }
    })).json().data.item.id as string;

    const i3 = (await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "t3", content: "c3" }
    })).json().data.item.id as string;

    const res = await app.inject({
      method: "GET",
      url: "/items?limit=2&offset=1",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.page).toEqual({ limit: 2, offset: 1, total: 3 });
    expect(body.data.items.length).toBe(2);
    expect(body.data.items.map((x: any) => x.id)).toEqual([i2, i3]);

    await app.close();
    closeDb(db);
  });
});
