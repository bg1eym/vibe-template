import type { FastifyInstance } from "fastify";
import {
  createItem,
  deleteItem,
  getItem,
  listItemsPageByOwner,
  updateItem,
} from "../services/itemService.js";
import { AppError } from "../lib/errors.js";
import { ok } from "../lib/http.js";

const itemBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "content"],
  properties: {
    title: { type: "string", minLength: 1 },
    content: { type: "string", minLength: 1 },
  },
} as const;

const listQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: 100 },
    offset: { type: "integer", minimum: 0 },
  },
} as const;

function parseIntParam(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isInteger(n)) return n;
  }
  return null;
}

export async function registerItemRoutes(app: FastifyInstance) {
  app.get("/items", { schema: { querystring: listQuerySchema } }, async (req) => {
    const ownerId = req.userId as string;

    const q = (req.query ?? {}) as any;

    const limitRaw = q.limit;
    const offsetRaw = q.offset;

    const limit = limitRaw === undefined ? 20 : parseIntParam(limitRaw);
    const offset = offsetRaw === undefined ? 0 : parseIntParam(offsetRaw);

    if (limit === null || offset === null) {
      throw new AppError("BAD_REQUEST", 400, "invalid pagination");
    }
    if (limit < 1 || limit > 100 || offset < 0) {
      throw new AppError("BAD_REQUEST", 400, "invalid pagination");
    }

    const { items, total } = listItemsPageByOwner(app.deps.db, ownerId, limit, offset);
    return ok({ items, page: { limit, offset, total } });
  });

  app.post("/items", { schema: { body: itemBodySchema } }, async (req, reply) => {
    const ownerId = req.userId as string;

    const body = req.body as { title: string; content: string };
    const item = createItem(app.deps.db, {
      ownerId,
      title: body.title,
      content: body.content,
    });

    return reply.code(201).send(ok({ item }));
  });

  app.get("/items/:id", async (req) => {
    const ownerId = req.userId as string;

    const id = (req.params as any).id as string;
    const item = getItem(app.deps.db, id);
    if (!item) throw new AppError("ITEM_NOT_FOUND", 404, "item not found");
    if (item.owner_id !== ownerId) throw new AppError("FORBIDDEN", 403, "not your item");

    return ok({ item });
  });

  app.put("/items/:id", { schema: { body: itemBodySchema } }, async (req) => {
    const ownerId = req.userId as string;

    const id = (req.params as any).id as string;
    const body = req.body as { title: string; content: string };

    const item = updateItem(app.deps.db, {
      id,
      ownerId,
      title: body.title,
      content: body.content,
    });

    return ok({ item });
  });

  app.delete("/items/:id", async (req) => {
    const ownerId = req.userId as string;

    const id = (req.params as any).id as string;

    const res = deleteItem(app.deps.db, { id, ownerId });
    if (!res.deleted) throw new AppError("ITEM_NOT_FOUND", 404, "item not found");
    return ok({ deleted: true });
  });
}
