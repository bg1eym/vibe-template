import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";
import {
  createItem,
  deleteItem,
  getItem,
  listItemsPageByOwner,
  updateItem,
} from "../services/itemService.js";

const createBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "content"],
  properties: {
    title: { type: "string", minLength: 1 },
    content: { type: "string", minLength: 1 },
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
    const limit =
      req.query && typeof (req.query as any).limit !== "undefined"
        ? Number((req.query as any).limit)
        : 20;
    const offset =
      req.query && typeof (req.query as any).offset !== "undefined"
        ? Number((req.query as any).offset)
        : 0;

    const page = listItemsPageByOwner(db, ownerId, limit, offset);
    return reply.send({
      success: true,
      data: {
        page: { limit, offset, total: page.total },
        items: page.items,
      },
    });
  });

  app.post("/items", { schema: { body: createBodySchema } }, async (req, reply) => {
    const ownerId = req.ownerId as string;
    const body = req.body as { title: string; content: string };

    const item = createItem(db, { ownerId, title: body.title, content: body.content });
    return reply.code(201).send({ success: true, data: { item } });
  });

  app.get("/items/:id", async (req, reply) => {
    const ownerId = req.ownerId as string;
    const id = (req.params as any).id as string;

    const item = getItem(db, id);
    if (!item || item.owner_id !== ownerId) {
      throw new AppError("ITEM_NOT_FOUND", 404, "item not found");
    }
    return reply.send({ success: true, data: { item } });
  });

  app.put("/items/:id", { schema: { body: updateBodySchema } }, async (req, reply) => {
    const ownerId = req.ownerId as string;
    const id = (req.params as any).id as string;
    const body = req.body as { title: string; content: string };

    const item = updateItem(db, { id, ownerId, title: body.title, content: body.content });
    return reply.send({ success: true, data: { item } });
  });

  app.delete("/items/:id", async (req, reply) => {
    const ownerId = req.ownerId as string;
    const id = (req.params as any).id as string;

    deleteItem(db, { id, ownerId });
    return reply.send({ success: true, data: { deleted: true } });
  });
}
