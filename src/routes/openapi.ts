import type { FastifyInstance } from "fastify";
import { OPENAPI_SPEC } from "../lib/openapiSpec.js";

export async function registerOpenApiRoutes(app: FastifyInstance) {
  app.get("/openapi.json", async (_req, reply) => {
    return reply.type("application/json").send(OPENAPI_SPEC);
  });

  app.get("/docs", async (_req, reply) => {
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>API Docs</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system; margin: 24px; }
      code, pre { background: #f6f6f6; padding: 8px; border-radius: 8px; }
      a { color: #2563eb; }
    </style>
  </head>
  <body>
    <h1>API Docs</h1>
    <p>OpenAPI spec:</p>
    <p><a href="/openapi.json">/openapi.json</a></p>

    <h2>Quick checks</h2>
    <pre><code>curl -sS http://127.0.0.1:3000/openapi.json | head
curl -sS http://127.0.0.1:3000/health</code></pre>

    <p>For interactive UI, paste the spec into your favorite OpenAPI viewer.</p>
  </body>
</html>`;
    return reply.type("text/html; charset=utf-8").send(html);
  });
}
