import type { DbClient } from "../db/client.js";
import { randomUUID } from "node:crypto";
import { AppError } from "../lib/errors.js";

export type UserRow = {
  id: string;
  email: string;
  created_at: string;
};

export type ItemRow = {
  id: string;
  owner_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export function createUser(db: DbClient, email: string): UserRow {
  const now = new Date().toISOString();
  const id = randomUUID();

  db.prepare("insert into users (id, email, created_at) values (?, ?, ?)").run(id, email, now);

  return { id, email, created_at: now };
}

function assertUserExists(db: DbClient, ownerId: string) {
  const row = db.prepare("select id from users where id = ?").get(ownerId) as
    | { id: string }
    | undefined;
  if (!row) {
    throw new AppError("USER_NOT_FOUND", 404, "owner does not exist");
  }
}

export function createItem(
  db: DbClient,
  input: { ownerId: string; title: string; content: string },
): ItemRow {
  assertUserExists(db, input.ownerId);

  const now = new Date().toISOString();
  const id = randomUUID();

  db.prepare(
    "insert into items (id, owner_id, title, content, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
  ).run(id, input.ownerId, input.title, input.content, now, now);

  return {
    id,
    owner_id: input.ownerId,
    title: input.title,
    content: input.content,
    created_at: now,
    updated_at: now,
  };
}

export function getItem(db: DbClient, id: string): ItemRow | null {
  const row = db
    .prepare("select id, owner_id, title, content, created_at, updated_at from items where id = ?")
    .get(id) as ItemRow | undefined;

  return row ?? null;
}

export function listItemsByOwner(db: DbClient, ownerId: string): ItemRow[] {
  return db
    .prepare(
      "select id, owner_id, title, content, created_at, updated_at from items where owner_id = ? order by created_at asc, rowid asc",
    )
    .all(ownerId) as ItemRow[];
}

export function listItemsPageByOwner(
  db: DbClient,
  ownerId: string,
  limit: number,
  offset: number,
): { items: ItemRow[]; total: number } {
  const totalRow = db
    .prepare("select count(*) as n from items where owner_id = ?")
    .get(ownerId) as { n: number };

  const items = db
    .prepare(
      "select id, owner_id, title, content, created_at, updated_at from items where owner_id = ? order by created_at asc, rowid asc limit ? offset ?",
    )
    .all(ownerId, limit, offset) as ItemRow[];

  return { items, total: totalRow.n };
}

export function updateItem(
  db: DbClient,
  input: { id: string; ownerId: string; title: string; content: string },
): ItemRow {
  const existing = db.prepare("select id, owner_id from items where id = ?").get(input.id) as
    | { id: string; owner_id: string }
    | undefined;

  if (!existing) {
    throw new AppError("ITEM_NOT_FOUND", 404, "item not found");
  }
  if (existing.owner_id !== input.ownerId) {
    throw new AppError("FORBIDDEN", 403, "not your item");
  }

  const now = new Date().toISOString();

  db.prepare("update items set title = ?, content = ?, updated_at = ? where id = ?").run(
    input.title,
    input.content,
    now,
    input.id,
  );

  const updated = getItem(db, input.id);
  if (!updated) {
    throw new AppError("ITEM_NOT_FOUND", 404, "item not found");
  }
  return updated;
}

export function deleteItem(
  db: DbClient,
  input: { id: string; ownerId: string },
): { deleted: boolean } {
  const existing = db.prepare("select id, owner_id from items where id = ?").get(input.id) as
    | { id: string; owner_id: string }
    | undefined;

  if (!existing) {
    return { deleted: false };
  }
  if (existing.owner_id !== input.ownerId) {
    throw new AppError("FORBIDDEN", 403, "not your item");
  }

  const res = db.prepare("delete from items where id = ?").run(input.id);
  return { deleted: res.changes === 1 };
}
