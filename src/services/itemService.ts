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
  tags: string;
  created_at: string;
  updated_at: string;
};

export function parseTagsJson(tagsJson: string): string[] {
  try {
    const arr = JSON.parse(tagsJson) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function tagsToJson(tags: string[]): string {
  return JSON.stringify(tags.filter((t) => typeof t === "string" && t.length > 0));
}

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
  input: { ownerId: string; title: string; content: string; tags?: string[] },
): ItemRow {
  assertUserExists(db, input.ownerId);

  const now = new Date().toISOString();
  const id = randomUUID();
  const tags = tagsToJson(input.tags ?? []);

  db.prepare(
    "insert into items (id, owner_id, title, content, tags, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, input.ownerId, input.title, input.content, tags, now, now);

  return {
    id,
    owner_id: input.ownerId,
    title: input.title,
    content: input.content,
    tags,
    created_at: now,
    updated_at: now,
  };
}

export function getItem(db: DbClient, id: string): ItemRow | null {
  const row = db
    .prepare(
      "select id, owner_id, title, content, tags, created_at, updated_at from items where id = ?",
    )
    .get(id) as ItemRow | undefined;

  return row ?? null;
}

export function listItemsByOwner(db: DbClient, ownerId: string): ItemRow[] {
  return db
    .prepare(
      "select id, owner_id, title, content, tags, created_at, updated_at from items where owner_id = ? order by created_at asc, rowid asc",
    )
    .all(ownerId) as ItemRow[];
}

export type ListItemsFilters = {
  q?: string;
  tag?: string;
};

export function listItemsPageByOwner(
  db: DbClient,
  ownerId: string,
  limit: number,
  offset: number,
  filters?: ListItemsFilters,
): { items: ItemRow[]; total: number } {
  const q = filters?.q?.trim();
  const tag = filters?.tag?.trim();
  const hasQ = q && q.length > 0;
  const hasTag = tag && tag.length > 0;

  const whereClause =
    !hasQ && !hasTag
      ? "owner_id = ?"
      : hasQ && !hasTag
        ? "owner_id = ? AND (lower(title) LIKE ? OR lower(content) LIKE ?)"
        : !hasQ && hasTag
          ? "owner_id = ? AND tags LIKE ?"
          : "owner_id = ? AND (lower(title) LIKE ? OR lower(content) LIKE ?) AND tags LIKE ?";

  const likeQ = hasQ ? `%${q!.toLowerCase()}%` : "";
  const tagPattern = hasTag ? `%"${tag!.replace(/"/g, "")}"%` : "";

  const totalParams: unknown[] = [ownerId];
  if (hasQ) totalParams.push(likeQ, likeQ);
  if (hasTag) totalParams.push(tagPattern);

  const totalRow = db
    .prepare(`select count(*) as n from items where ${whereClause}`)
    .get(...totalParams) as { n: number };

  const selectParams: unknown[] = [ownerId];
  if (hasQ) selectParams.push(likeQ, likeQ);
  if (hasTag) selectParams.push(tagPattern);
  selectParams.push(limit, offset);

  const items = db
    .prepare(
      `select id, owner_id, title, content, tags, created_at, updated_at from items where ${whereClause} order by created_at asc, rowid asc limit ? offset ?`,
    )
    .all(...selectParams) as ItemRow[];

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
