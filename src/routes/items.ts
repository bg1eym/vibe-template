import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";
import {
  createItem,
  deleteItem,
  getItem,
  listItemsPageByOwner,
  parseTagsJson,
  updateItem,
} from "../services/itemService.js";

const createBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "content"],
  properties: {
    title: { type: "string", minLength: 1 },
    content: { type: "string", minLength: 1 },
    tags: { type: "array", items: { type: "string" } },
  },
} as const;

const updateBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "content"],
  properties: {
    title: { type: "string", minLength: 1 },
    content: { type: "string", minLength: 1 },
  },
} as const;

export async function registerItemRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  app.get("/items", async (req, reply) => {
    const ownerId = req.ownerId as string;
    const q =
      req.query && typeof (req.query as Record<string, unknown>).q === "string"
        ? ((req.query as Record<string, unknown>).q as string)
        : undefined;
    const tag =
      req.query && typeof (req.query as Record<string, unknown>).tag === "string"
        ? ((req.query as Record<string, unknown>).tag as string)
        : undefined;
    const limit =
      req.query && typeof (req.query as Record<string, unknown>).limit !== "undefined"
        ? Number((req.query as Record<string, unknown>).limit)
        : 20;
    const offset =
      req.query && typeof (req.query as Record<string, unknown>).offset !== "undefined"
        ? Number((req.query as Record<string, unknown>).offset)
        : 0;

    const page = listItemsPageByOwner(db, ownerId, limit, offset, { q, tag });
    const items = page.items.map((it) => ({
      ...it,
      tags: parseTagsJson(it.tags),
    }));
    return reply.send({
      success: true,
      data: {
        page: { limit, offset, total: page.total },
        items,
      },
    });
  });

  app.post("/items", { schema: { body: createBodySchema } }, async (req, reply) => {
    const ownerId = req.ownerId as string;
    const body = req.body as { title: string; content: string; tags?: string[] };

    const item = createItem(db, {
      ownerId,
      title: body.title,
      content: body.content,
      tags: body.tags,
    });
    return reply.code(201).send({
      success: true,
      data: { item: { ...item, tags: parseTagsJson(item.tags) } },
    });
  });

  app.get("/items/:id", async (req, reply) => {
    const ownerId = req.ownerId as string;
    const id = (req.params as any).id as string;

    const item = getItem(db, id);
    if (!item) {
      throw new AppError("ITEM_NOT_FOUND", 404, "item not found");
    }
    if (item.owner_id !== ownerId) {
      throw new AppError("FORBIDDEN", 403, "not your item");
    }
    return reply.send({
      success: true,
      data: { item: { ...item, tags: parseTagsJson(item.tags) } },
    });
  });

  app.put("/items/:id", { schema: { body: updateBodySchema } }, async (req, reply) => {
    const ownerId = req.ownerId as string;
    const id = (req.params as any).id as string;
    const body = req.body as { title: string; content: string };

    const item = updateItem(db, { id, ownerId, title: body.title, content: body.content });
    return reply.send({
      success: true,
      data: { item: { ...item, tags: parseTagsJson(item.tags) } },
    });
  });

  app.delete("/items/:id", async (req, reply) => {
    const ownerId = req.ownerId as string;
    const id = (req.params as any).id as string;

    deleteItem(db, { id, ownerId });
    return reply.send({ success: true, data: { deleted: true } });
  });
}
