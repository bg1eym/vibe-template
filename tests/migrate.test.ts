import { describe, it, expect } from "vitest";
import { openDb, closeDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";

describe("db migration", () => {
  it("creates users and items tables", () => {
    const db = openDb(":memory:");
    migrate(db);

    const tables = db
      .prepare("select name from sqlite_master where type='table' order by name")
      .all() as Array<{ name: string }>;

    const names = tables.map((t) => t.name);
    expect(names).toContain("users");
    expect(names).toContain("items");

    closeDb(db);
  });
});
