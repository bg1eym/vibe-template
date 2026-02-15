import { describe, it, expect } from "vitest";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import {
  createUser,
  createItem,
  getItem,
  listItemsByOwner,
  updateItem,
  deleteItem,
} from "../src/services/itemService.js";

describe("item service (db-only)", () => {
  it("creates, reads, lists, updates, deletes items for an owner", () => {
    const db = openDb(":memory:");
    migrate(db);

    const user = createUser(db, "a@example.com");

    const item1 = createItem(db, {
      ownerId: user.id,
      title: "t1",
      content: "c1",
    });
    const item2 = createItem(db, {
      ownerId: user.id,
      title: "t2",
      content: "c2",
    });

    const got = getItem(db, item1.id);
    expect(got?.id).toBe(item1.id);

    const list = listItemsByOwner(db, user.id);
    expect(list.map((x) => x.id)).toEqual([item1.id, item2.id]);

    const updated = updateItem(db, {
      id: item1.id,
      ownerId: user.id,
      title: "t1b",
      content: "c1b",
    });
    expect(updated.title).toBe("t1b");
    expect(updated.content).toBe("c1b");

    const del = deleteItem(db, { id: item2.id, ownerId: user.id });
    expect(del.deleted).toBe(true);
    expect(getItem(db, item2.id)).toBeNull();

    closeDb(db);
  });

  it("rejects creating item for missing user", () => {
    const db = openDb(":memory:");
    migrate(db);

    expect(() => createItem(db, { ownerId: "missing", title: "t", content: "c" })).toThrow(
      "owner does not exist",
    );

    closeDb(db);
  });

  it("prevents modifying items of another owner", () => {
    const db = openDb(":memory:");
    migrate(db);

    const u1 = createUser(db, "u1@example.com");
    const u2 = createUser(db, "u2@example.com");

    const item = createItem(db, { ownerId: u1.id, title: "t", content: "c" });

    try {
      updateItem(db, { id: item.id, ownerId: u2.id, title: "x", content: "y" });
      throw new Error("expected error");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
      expect(e.statusCode).toBe(403);
    }

    try {
      deleteItem(db, { id: item.id, ownerId: u2.id });
      throw new Error("expected error");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
      expect(e.statusCode).toBe(403);
    }

    closeDb(db);
  });
});
