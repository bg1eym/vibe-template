import Fastify from "fastify";
import { registerHealthRoutes } from "./routes/health.js";
import { registerItemRoutes } from "./routes/items.js";
import { openDb, closeDb, type DbClient } from "./db/client.js";
import { migrate } from "./db/migrate.js";
import { isAppError } from "./lib/errors.js";
import { err, internalError, badRequest } from "./lib/http.js";

export type AppDeps = {
  db: DbClient;
};

export function buildApp(deps?: Partial<AppDeps>) {
  const app = Fastify({ logger: false });

  const db =
    deps?.db ??
    (() => {
      const d = openDb(process.env.DB_FILE ?? "app.sqlite");
      migrate(d);
      return d;
    })();

  app.decorate("deps", { db } satisfies AppDeps);

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

  app.addHook("onClose", async () => {
    closeDb(db);
  });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    deps: AppDeps;
  }
}
