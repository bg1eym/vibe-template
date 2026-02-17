import type { FastifyInstance } from "fastify";
import { CSP } from "../lib/csp.js";

const UI_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Items UI</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="stylesheet" href="/assets/ui.css" />
</head>
<body>
  <h1>Items UI</h1>

  <div class="section">
    <div class="row">
      <label>Token (ownerId):</label>
      <input id="token" type="text" class="input-token" placeholder="user_xxx or owner-id" />
      <label>q:</label>
      <input id="q" type="text" placeholder="search title/content" />
      <label>tag:</label>
      <input id="tag" type="text" placeholder="filter by tag" />
      <button id="query">Query</button>
    </div>
    <div id="error" class="error"></div>
  </div>

  <div class="section">
    <h3>Items</h3>
    <div id="list"></div>
  </div>

  <div class="section">
    <h3>New Item</h3>
    <div class="row">
      <input id="new-title" type="text" placeholder="title" />
      <input id="new-content" type="text" placeholder="content" />
      <input id="new-tags" type="text" class="input-tags" placeholder="tags (comma-separated)" />
      <button id="create">Create</button>
    </div>
  </div>

  <div class="section">
    <h3>Tags (from current list)</h3>
    <div id="chart" class="chart"></div>
    <div id="chart-labels" class="chart-labels"></div>
  </div>

  <script src="/assets/ui.js"></script>
</body>
</html>`;

export async function registerUiRoutes(app: FastifyInstance) {
  app.get("/ui", async (_req, reply) => {
    return reply
      .header("Content-Security-Policy", CSP)
      .type("text/html; charset=utf-8")
      .send(UI_HTML);
  });
}
