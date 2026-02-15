import type { FastifyInstance } from "fastify";

const CSP = "script-src 'self'; object-src 'none'; base-uri 'self'";

const UI_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="script-src 'self'; object-src 'none'; base-uri 'self'" />
  <title>Items UI</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 16px; max-width: 800px; }
    input, button { padding: 8px 12px; margin: 4px; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
    .section { margin: 20px 0; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; }
    .error { color: #dc2626; background: #fef2f2; padding: 8px; border-radius: 4px; }
    .item { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .item:last-child { border-bottom: none; }
    .item-title { font-weight: 600; }
    .item-content { color: #6b7280; font-size: 0.9em; max-height: 2.4em; overflow: hidden; text-overflow: ellipsis; }
    .item-tags { margin-top: 4px; }
    .tag { display: inline-block; background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; margin-right: 4px; }
    .chart { display: flex; align-items: flex-end; gap: 8px; height: 120px; margin-top: 8px; }
    .chart-bar { flex: 1; min-width: 40px; background: #3b82f6; border-radius: 4px 4px 0 0; transition: height 0.2s; }
    .chart-labels { display: flex; gap: 8px; margin-top: 4px; }
    .chart-label { flex: 1; min-width: 40px; font-size: 0.8em; color: #6b7280; overflow: hidden; text-overflow: ellipsis; }
  </style>
</head>
<body>
  <h1>Items UI</h1>

  <div class="section">
    <div class="row">
      <label>Token (ownerId):</label>
      <input id="token" type="text" placeholder="user_xxx or owner-id" style="min-width: 180px" />
      <label>q:</label>
      <input id="q" type="text" placeholder="search title/content" />
      <label>tag:</label>
      <input id="tag" type="text" placeholder="filter by tag" />
      <button id="query">Query</button>
    </div>
    <div id="error" class="error" style="display:none"></div>
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
      <input id="new-tags" type="text" placeholder="tags (comma-separated)" style="min-width: 160px" />
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
