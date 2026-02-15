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
      payload: { title: "t1", content: "c1" },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.success).toBe(true);
    const itemId = created.data.item.id as string;

    const listRes = await app.inject({
      method: "GET",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
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
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(200);

    const putRes = await app.inject({
      method: "PUT",
      url: `/items/${itemId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "t1b", content: "c1b" },
    });
    expect(putRes.statusCode).toBe(200);
    expect(putRes.json().data.item.title).toBe("t1b");

    const delRes = await app.inject({
      method: "DELETE",
      url: `/items/${itemId}`,
      headers: { authorization: `Bearer ${token}` },
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
      error: { code: "UNAUTHORIZED", message: "missing authorization" },
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
      payload: { title: "", content: "" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      success: false,
      error: { code: "BAD_REQUEST", message: "invalid request" },
    });

    await app.close();
    closeDb(db);
  });

  it("returns 404 ITEM_NOT_FOUND when GET /items/:id with non-existent id", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "n@example.com");
    const token = bearerTokenForUser(user.id);

    const app = buildApp({ db });

    const res = await app.inject({
      method: "GET",
      url: "/items/non-existent-id",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      success: false,
      error: { code: "ITEM_NOT_FOUND", message: "item not found" },
    });

    await app.close();
    closeDb(db);
  });

  it("returns 403 FORBIDDEN when GET /items/:id for item owned by another user", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const userA = createUser(db, "a@example.com");
    const userB = createUser(db, "b@example.com");
    const tokenA = bearerTokenForUser(userA.id);
    const tokenB = bearerTokenForUser(userB.id);

    const app = buildApp({ db });

    const createRes = await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { title: "a's item", content: "content" },
    });
    expect(createRes.statusCode).toBe(201);
    const itemId = createRes.json().data.item.id as string;

    const res = await app.inject({
      method: "GET",
      url: `/items/${itemId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      success: false,
      error: { code: "FORBIDDEN", message: "not your item" },
    });

    await app.close();
    closeDb(db);
  });

  it("creates item with tags and retrieves it with tags array", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "t@example.com");
    const token = bearerTokenForUser(user.id);

    const app = buildApp({ db });

    const createRes = await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "tagged", content: "c", tags: ["a", "b"] },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.data.item.tags).toEqual(["a", "b"]);

    const getRes = await app.inject({
      method: "GET",
      url: `/items/${created.data.item.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().data.item.tags).toEqual(["a", "b"]);

    await app.close();
    closeDb(db);
  });

  it("GET /items?tag=... returns only items with that tag", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "tag@example.com");
    const token = bearerTokenForUser(user.id);

    const app = buildApp({ db });

    await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "x", content: "c", tags: ["alpha"] },
    });
    await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "y", content: "c", tags: ["beta"] },
    });
    await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "z", content: "c", tags: ["alpha", "beta"] },
    });

    const res = await app.inject({
      method: "GET",
      url: "/items?tag=alpha",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.items.length).toBe(2);
    expect(body.data.page.total).toBe(2);
    expect(body.data.items.every((it: { tags: string[] }) => it.tags.includes("alpha"))).toBe(true);

    await app.close();
    closeDb(db);
  });

  it("GET /items?q=... matches title and content", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "q@example.com");
    const token = bearerTokenForUser(user.id);

    const app = buildApp({ db });

    await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Hello World", content: "foo" },
    });
    await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "bar", content: "hello there" },
    });
    await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "baz", content: "qux" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/items?q=hello",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.items.length).toBe(2);
    expect(body.data.page.total).toBe(2);

    await app.close();
    closeDb(db);
  });

  it("GET /items?q=...&tag=... combines filters", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "qt@example.com");
    const token = bearerTokenForUser(user.id);

    const app = buildApp({ db });

    await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "match", content: "x", tags: ["t1"] },
    });
    await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "match", content: "y", tags: ["t2"] },
    });
    await app.inject({
      method: "POST",
      url: "/items",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "nope", content: "z", tags: ["t1"] },
    });

    const res = await app.inject({
      method: "GET",
      url: "/items?q=match&tag=t1",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.items.length).toBe(1);
    expect(body.data.page.total).toBe(1);
    expect(body.data.items[0].title).toBe("match");
    expect(body.data.items[0].tags).toContain("t1");

    await app.close();
    closeDb(db);
  });

  it("paginates GET /items with limit/offset", async () => {
    const db = openDb(":memory:");
    migrate(db);
    const user = createUser(db, "p@example.com");
    const token = bearerTokenForUser(user.id);

    const app = buildApp({ db });

    const _i1 = (
      await app.inject({
        method: "POST",
        url: "/items",
        headers: { authorization: `Bearer ${token}` },
        payload: { title: "t1", content: "c1" },
      })
    ).json().data.item.id as string;

    const i2 = (
      await app.inject({
        method: "POST",
        url: "/items",
        headers: { authorization: `Bearer ${token}` },
        payload: { title: "t2", content: "c2" },
      })
    ).json().data.item.id as string;

    const i3 = (
      await app.inject({
        method: "POST",
        url: "/items",
        headers: { authorization: `Bearer ${token}` },
        payload: { title: "t3", content: "c3" },
      })
    ).json().data.item.id as string;

    const res = await app.inject({
      method: "GET",
      url: "/items?limit=2&offset=1",
      headers: { authorization: `Bearer ${token}` },
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
