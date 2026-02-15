import type { DbClient } from "./client.js";
import { SCHEMA_SQL } from "./schema.js";

export function migrate(db: DbClient) {
  db.exec(SCHEMA_SQL);
  const cols = db.prepare("PRAGMA table_info(items)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "tags")) {
    db.exec("ALTER TABLE items ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
  }
}
