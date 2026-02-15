import type { FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function registerAssetsRoutes(app: FastifyInstance) {
  app.get("/assets/studio.js", async (_req, reply) => {
    const path = join(process.cwd(), "public", "studio.js");
    const content = readFileSync(path, "utf-8");
    return reply.type("application/javascript").send(content);
  });

  app.get("/assets/ui.js", async (_req, reply) => {
    const path = join(process.cwd(), "public", "ui.js");
    const content = readFileSync(path, "utf-8");
    return reply.type("application/javascript").send(content);
  });
}
