import type { FastifyInstance } from "fastify";
import { analyzeAi } from "../services/analyzeAiService.js";
import {
  matchScifiAi,
  repairMatchScifiAi,
  expandMatchScifiAi,
  rerankMatchScifiAi,
  improveMatchScifiAi,
} from "../services/matchScifiAiService.js";
import { AppError } from "../lib/errors.js";

const analyzeAiBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: { text: { type: "string" } },
} as const;

const matchScifiAiBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["analysis"],
  properties: {
    analysis: { type: "object" },
    selected_points: { type: "array", items: { type: "string" } },
  },
} as const;

const repairMatchScifiAiBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["draft", "issues", "analysis"],
  properties: {
    draft: { type: "object" },
    issues: { type: "array" },
    analysis: { type: "object" },
  },
} as const;

const feedbackSchema = {
  type: "object",
  properties: {
    keep_ids: { type: "array", items: { type: "string" } },
    reject_ids: { type: "array", items: { type: "string" } },
    boost_ids: { type: "array", items: { type: "string" } },
    notes_by_id: { type: "object" },
    desired_style: { type: "string" },
  },
} as const;

const expandMatchScifiAiBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["analysis", "selected_points", "existing_candidates"],
  properties: {
    analysis: { type: "object" },
    selected_points: { type: "array", items: { type: "string" } },
    existing_candidates: { type: "array" },
    feedback: feedbackSchema,
  },
} as const;

const rerankMatchScifiAiBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidates", "analysis"],
  properties: {
    candidates: { type: "array" },
    analysis: { type: "object" },
    selected_points: { type: "array", items: { type: "string" } },
    feedback: feedbackSchema,
  },
} as const;

const improveMatchScifiAiBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["analysis", "candidates", "target_ids"],
  properties: {
    analysis: { type: "object" },
    selected_points: { type: "array", items: { type: "string" } },
    candidates: { type: "array" },
    target_ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
    feedback: feedbackSchema,
  },
} as const;

export async function registerAnalyzeAiRoutes(app: FastifyInstance) {
  const getLlm = () => app.deps.llmClient;

  app.post("/analyze_ai", { schema: { body: analyzeAiBodySchema } }, async (req, reply) => {
    const body = req.body as { text: string };
    const llm = getLlm();
    if (!llm) {
      throw new AppError("BAD_UPSTREAM", 503, "LLM not configured (set LLM_API_KEY)");
    }
    const analysis = await analyzeAi(body.text ?? "", llm);
    return reply.send({
      success: true,
      data: { analysis, pipeline: { mode: "analyze_ai", llm_calls: 1 } },
    });
  });

  app.post("/match_scifi_ai", { schema: { body: matchScifiAiBodySchema } }, async (req, reply) => {
    const body = req.body as { analysis: unknown; selected_points?: string[] };
    const llm = getLlm();
    if (!llm) {
      throw new AppError("BAD_UPSTREAM", 503, "LLM not configured (set LLM_API_KEY)");
    }
    const analysis = body.analysis as Parameters<typeof matchScifiAi>[0];
    const selectedPoints = body.selected_points ?? [];
    const result = await matchScifiAi(analysis, selectedPoints, llm);
    return reply.send({ success: true, data: result });
  });

  app.post(
    "/repair_match_scifi_ai",
    { schema: { body: repairMatchScifiAiBodySchema } },
    async (req, reply) => {
      const body = req.body as { draft: unknown; issues: unknown[]; analysis: unknown };
      const llm = getLlm();
      if (!llm) {
        throw new AppError("BAD_UPSTREAM", 503, "LLM not configured (set LLM_API_KEY)");
      }
      const draft = body.draft as Parameters<typeof repairMatchScifiAi>[0];
      const issues = body.issues as Parameters<typeof repairMatchScifiAi>[1];
      const analysis = body.analysis as Parameters<typeof repairMatchScifiAi>[2];
      const result = await repairMatchScifiAi(draft, issues, analysis, llm);
      return reply.send({ success: true, data: result });
    },
  );

  app.post(
    "/match_scifi_ai_expand",
    { schema: { body: expandMatchScifiAiBodySchema } },
    async (req, reply) => {
      const body = req.body as {
        analysis: unknown;
        selected_points: string[];
        existing_candidates: unknown[];
        feedback?: unknown;
      };
      const llm = getLlm();
      if (!llm) {
        throw new AppError("BAD_UPSTREAM", 503, "LLM not configured (set LLM_API_KEY)");
      }
      const analysis = body.analysis as Parameters<typeof expandMatchScifiAi>[0];
      const selectedPoints = body.selected_points;
      const existing = body.existing_candidates as Parameters<typeof expandMatchScifiAi>[2];
      const feedback = body.feedback as Parameters<typeof expandMatchScifiAi>[4];
      const result = await expandMatchScifiAi(analysis, selectedPoints, existing, llm, feedback);
      return reply.send({ success: true, data: result });
    },
  );

  app.post(
    "/match_scifi_ai_rerank",
    { schema: { body: rerankMatchScifiAiBodySchema } },
    async (req, reply) => {
      const body = req.body as {
        candidates: unknown[];
        analysis: unknown;
        selected_points?: string[];
        feedback?: unknown;
      };
      const llm = getLlm();
      if (!llm) {
        throw new AppError("BAD_UPSTREAM", 503, "LLM not configured (set LLM_API_KEY)");
      }
      const candidates = body.candidates as Parameters<typeof rerankMatchScifiAi>[0];
      const analysis = body.analysis as Parameters<typeof rerankMatchScifiAi>[1];
      const feedback = body.feedback as Parameters<typeof rerankMatchScifiAi>[3];
      const result = await rerankMatchScifiAi(candidates, analysis, llm, feedback);
      return reply.send({ success: true, data: result });
    },
  );

  app.post(
    "/match_scifi_ai_improve",
    { schema: { body: improveMatchScifiAiBodySchema } },
    async (req, reply) => {
      const body = req.body as {
        analysis: unknown;
        selected_points?: string[];
        candidates: unknown[];
        target_ids: string[];
        feedback?: unknown;
      };
      const llm = getLlm();
      if (!llm) {
        throw new AppError("BAD_UPSTREAM", 503, "LLM not configured (set LLM_API_KEY)");
      }
      const candidates = body.candidates as Parameters<typeof improveMatchScifiAi>[0];
      const selectedPoints = body.selected_points ?? [];
      const targetIds = body.target_ids;
      const analysis = body.analysis as Parameters<typeof improveMatchScifiAi>[3];
      const feedback = body.feedback as Parameters<typeof improveMatchScifiAi>[5];
      const result = await improveMatchScifiAi(
        candidates,
        targetIds,
        selectedPoints,
        analysis,
        llm,
        feedback,
      );
      return reply.send({ success: true, data: result });
    },
  );
}
