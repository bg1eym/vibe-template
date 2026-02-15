import Fastify from "fastify";
import { registerHealthRoutes } from "./routes/health.js";
import { registerItemRoutes } from "./routes/items.js";
import { registerOpenApiRoutes } from "./routes/openapi.js";
import { openDb, closeDb, type DbClient } from "./db/client.js";
import { migrate } from "./db/migrate.js";
import { isAppError, AppError } from "./lib/errors.js";
import { err, internalError, badRequest } from "./lib/http.js";
import { getConfig } from "./lib/config.js";
import { getOwnerId } from "./lib/auth.js";

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
  app.decorateRequest("ownerId", undefined);

  // Centralized auth requirement:
  // Enforce auth for /items* routes, attach req.ownerId for handlers.
  app.addHook("preHandler", async (req) => {
    if (!req.url.startsWith("/items")) return;

    const ownerId = getOwnerId(req);
    if (!ownerId) {
      throw new AppError("UNAUTHORIZED", 401, "missing authorization");
    }
    req.ownerId = ownerId;
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
    ownerId?: string;
  }
}
