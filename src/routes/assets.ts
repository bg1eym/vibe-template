import type { FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ASSETS_CACHE = "public, max-age=3600";

export async function registerAssetsRoutes(app: FastifyInstance) {
  app.get("/assets/studio.js", async (_req, reply) => {
    const path = join(process.cwd(), "dist", "public", "studio.js");
    const content = readFileSync(path, "utf-8");
    return reply
      .header("cache-control", ASSETS_CACHE)
      .type("application/javascript; charset=utf-8")
      .send(content);
  });

  app.get("/assets/ui.js", async (_req, reply) => {
    const path = join(process.cwd(), "dist", "public", "ui.js");
    const content = readFileSync(path, "utf-8");
    return reply
      .header("cache-control", ASSETS_CACHE)
      .type("application/javascript; charset=utf-8")
      .send(content);
  });

  app.get("/assets/studio.css", async (_req, reply) => {
    const path = join(process.cwd(), "dist", "public", "studio.css");
    const content = readFileSync(path, "utf-8");
    return reply
      .header("cache-control", ASSETS_CACHE)
      .type("text/css; charset=utf-8")
      .send(content);
  });

  app.get("/assets/ui.css", async (_req, reply) => {
    const path = join(process.cwd(), "dist", "public", "ui.css");
    const content = readFileSync(path, "utf-8");
    return reply
      .header("cache-control", ASSETS_CACHE)
      .type("text/css; charset=utf-8")
      .send(content);
  });
}
