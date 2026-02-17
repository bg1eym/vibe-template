import crypto from "node:crypto";
import Fastify from "fastify";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAnalyzeRoutes } from "./routes/analyze.js";
import { registerAnalyzeAiRoutes } from "./routes/analyzeAi.js";
import { registerItemRoutes } from "./routes/items.js";
import { registerOpenApiRoutes } from "./routes/openapi.js";
import { registerUiRoutes } from "./routes/ui.js";
import { registerStudioRoutes } from "./routes/studio.js";
import { registerAssetsRoutes } from "./routes/assets.js";
import { openDb, closeDb, type DbClient } from "./db/client.js";
import { migrate } from "./db/migrate.js";
import { isAppError, AppError } from "./lib/errors.js";
import { err, internalError, badRequest } from "./lib/http.js";
import { getConfig } from "./lib/config.js";
import { getOwnerId } from "./lib/auth.js";
import { createLlmClient, getLlmConfig } from "./lib/llmClient.js";
import type { LlmClient } from "./lib/llmClient.js";

export type AppDeps = {
  db: DbClient;
  llmClient: LlmClient | null;
};

function shortId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function buildApp(deps?: Partial<AppDeps>) {
  const app = Fastify({ logger: false });

  const cfg = getConfig();

  const db =
    deps?.db ??
    (() => {
      const d = openDb(cfg.dbFile);
      migrate(d);
      return d;
    })();

  const llmClient =
    deps?.llmClient !== undefined ? deps.llmClient : createLlmClient(getLlmConfig());

  app.decorate("deps", { db, llmClient } satisfies AppDeps);
  app.decorateRequest("ownerId", undefined);
  app.decorateRequest("reqId", "");

  app.addHook("onRequest", async (req, reply) => {
    const id = shortId();
    req.reqId = id;
    void reply.header("x-req-id", id);
  });

  // Centralized auth requirement:
  // Enforce auth for /items* and /analyze routes, attach req.ownerId for handlers.
  app.addHook("preHandler", async (req) => {
    const needsAuth =
      req.url.startsWith("/items") ||
      req.url.startsWith("/analyze") ||
      req.url.startsWith("/expand") ||
      req.url.startsWith("/analyze_ai") ||
      req.url.startsWith("/match_scifi_ai") ||
      req.url.startsWith("/repair_match_scifi_ai") ||
      req.url.startsWith("/match_scifi_ai_expand") ||
      req.url.startsWith("/match_scifi_ai_rerank") ||
      req.url.startsWith("/match_scifi_ai_improve");
    if (!needsAuth) return;

    const ownerId = getOwnerId(req);
    if (!ownerId) {
      throw new AppError("UNAUTHORIZED", 401, "missing authorization");
    }
    req.ownerId = ownerId;
  });

  app.setErrorHandler((error, req, reply) => {
    const reqId = req.reqId ?? "";
    const anyErr = error as Record<string, unknown>;

    if (anyErr && anyErr.validation) {
      console.error(`[${reqId}] ${req.method} ${req.url} 400 validation_error`);
      return reply.code(400).send({ ...badRequest("invalid request"), req_id: reqId });
    }

    if (isAppError(error)) {
      console.error(
        `[${reqId}] ${req.method} ${req.url} ${error.statusCode} ${error.code}: ${error.message}`,
      );
      return reply
        .code(error.statusCode)
        .send({ ...err(error.code, error.message), req_id: reqId });
    }

    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error(`[${reqId}] ${req.method} ${req.url} 500 INTERNAL: ${msg}`);
    if (stack) console.error(stack);
    return reply.code(500).send({ ...internalError(), req_id: reqId });
  });

  app.addHook("onResponse", async (req, reply) => {
    const reqId = req.reqId ?? "";
    const status = reply.statusCode;
    const elapsed = reply.elapsedTime?.toFixed(0) ?? "?";
    if (status >= 400) {
      console.error(`[${reqId}] ${req.method} ${req.url} ${status} ${elapsed}ms`);
    }
  });

  void registerHealthRoutes(app);
  void registerAnalyzeRoutes(app);
  void registerAnalyzeAiRoutes(app);
  void registerItemRoutes(app);
  void registerOpenApiRoutes(app);
  void registerUiRoutes(app);
  void registerStudioRoutes(app);
  void registerAssetsRoutes(app);

  app.addHook("onClose", async () => {
    closeDb(db);
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    deps: AppDeps;
  }

  interface FastifyRequest {
    ownerId?: string;
    reqId?: string;
  }
}
