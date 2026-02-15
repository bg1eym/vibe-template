import Database from "better-sqlite3";

export type DbClient = Database.Database;

export function openDb(filename: string) {
  return new Database(filename);
}

export function closeDb(db: DbClient) {
  db.close();
}
