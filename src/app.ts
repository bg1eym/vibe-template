import Fastify from "fastify";
import { registerHealthRoutes } from "./routes/health.js";
import { registerItemRoutes } from "./routes/items.js";
import { registerOpenApiRoutes } from "./routes/openapi.js";
import { openDb, closeDb, type DbClient } from "./db/client.js";
import { migrate } from "./db/migrate.js";
import { isAppError, AppError } from "./lib/errors.js";
import { err, internalError, badRequest } from "./lib/http.js";
import { getConfig } from "./lib/config.js";
import { parseAuth } from "./lib/auth.js";

export type AppDeps = {
  db: DbClient;
};

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

  app.decorate("deps", { db } satisfies AppDeps);
  app.decorateRequest("userId", undefined);

  // Centralized auth requirement:
  // Enforce auth for /items* routes, attach req.userId for handlers.
  app.addHook("preHandler", async (req) => {
    if (!req.url.startsWith("/items")) return;

    const r = parseAuth(req.headers as any);
    if (!r.ok) {
      throw new AppError("UNAUTHORIZED", 401, r.message);
    }
    req.userId = r.userId;
  });

  app.setErrorHandler((error, _req, reply) => {
    const anyErr: any = error as any;

    if (anyErr && anyErr.validation) {
      return reply.code(400).send(badRequest("invalid request"));
    }

    if (isAppError(error)) {
      return reply.code(error.statusCode).send(err(error.code, error.message));
    }

    return reply.code(500).send(internalError());
  });

  void registerHealthRoutes(app);
  void registerItemRoutes(app);
  void registerOpenApiRoutes(app);

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
    userId?: string;
  }
}
