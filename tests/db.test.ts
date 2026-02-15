import { describe, it, expect } from "vitest";
import { openDb, closeDb } from "../src/db/client.js";

describe("db scaffold", () => {
  it("can open an in-memory sqlite db and run a query", () => {
    const db = openDb(":memory:");
    const row = db.prepare("select 1 as n").get() as { n: number };
    expect(row.n).toBe(1);
    closeDb(db);
  });
});
