import type { DbClient } from "./client.js";
import { SCHEMA_SQL } from "./schema.js";

export function migrate(db: DbClient) {
  db.exec(SCHEMA_SQL);
}
