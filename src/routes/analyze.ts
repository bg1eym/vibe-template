import type { FastifyInstance } from "fastify";
import { analyze, expand } from "../services/analyzeService.js";

const analyzeBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: {
    text: { type: "string" },
  },
} as const;

const expandBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: {
    text: { type: "string" },
    selectedTrackId: { type: "string" },
    selectedCategories: { type: "array", items: { type: "string" } },
    selectedWorkTitles: { type: "array", items: { type: "string" } },
  },
} as const;

export async function registerAnalyzeRoutes(app: FastifyInstance) {
  app.post("/analyze", { schema: { body: analyzeBodySchema } }, async (req, reply) => {
    const body = req.body as { text: string };
    const result = analyze(body.text ?? "");
    return reply.send({ success: true, data: result });
  });

  app.post("/expand", { schema: { body: expandBodySchema } }, async (req, reply) => {
    const body = req.body as {
      text: string;
      selectedTrackId?: string;
      selectedCategories?: string[];
      selectedWorkTitles?: string[];
    };
    const result = expand(
      body.text ?? "",
      body.selectedCategories ?? [],
      body.selectedWorkTitles ?? [],
      body.selectedTrackId,
    );
    return reply.send({ success: true, data: result });
  });
}
