import type { FastifyInstance } from "fastify";
import { CSP } from "../lib/csp.js";

const STUDIO_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>工作室</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="stylesheet" href="/assets/studio.css" />
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <h2>工作室</h2>
      <div class="section">
        <div class="section-title">令牌</div>
        <input id="token" type="text" placeholder="user_xxx 或 owner-id" />
      </div>
      <div class="section">
        <div class="section-title">步骤 1：分析</div>
        <textarea id="text" placeholder="粘贴要分析的文本或新闻…"></textarea>
        <div class="section-actions">
          <button id="analyze" class="btn-primary">分析</button>
          <button id="analyze-ai" class="btn-secondary">AI分析</button>
        </div>
      </div>
      <div id="tracks-section" class="section">
        <div id="step2-title" class="section-title">步骤 2：选择推荐路径</div>
        <div id="tracks-list"></div>
        <div id="news-points-list"></div>
      </div>
      <div id="expand-section" class="section">
        <div class="section-title">步骤 3：展开</div>
        <button id="expand" class="btn-secondary">生成剧情支撑</button>
      </div>
      <div id="error" class="error"></div>
    </aside>
    <main class="main">
      <div class="tabs">
        <button class="tab active" data-tab="cards">剧情支撑</button>
        <button class="tab" data-tab="outline">播客大纲</button>
        <button class="tab" data-tab="evidence">证据链</button>
      </div>
      <div id="tab-cards" class="tab-content active">
        <div id="process-trace"></div>
        <div id="cards-empty" class="empty">先完成分析，选择一条推荐路径，再点击「生成剧情支撑」。</div>
        <div id="cards-loading" class="loading"><div class="spinner"></div><span class="loading-text">正在加载...</span></div>
        <div id="cards-list"></div>
      </div>
      <div id="tab-outline" class="tab-content">
        <div id="outline-empty" class="empty">播客大纲包含：开场、框架、辩论、类比场景、反例、收尾。完成分析后自动展示。</div>
        <div id="outline-content"></div>
      </div>
      <div id="tab-evidence" class="tab-content">
        <div id="evidence-empty" class="empty">证据链展示：分类、机制、引用作品（含 hook 摘要）。完成分析后自动展示。引用原文默认折叠。</div>
        <div id="evidence-content"></div>
      </div>
    </main>
  </div>
  <script src="/assets/studio.js"></script>
</body>
</html>`;

export async function registerStudioRoutes(app: FastifyInstance) {
  app.get("/studio", async (_req, reply) => {
    return reply
      .header("Content-Security-Policy", CSP)
      .type("text/html; charset=utf-8")
      .send(STUDIO_HTML);
  });
}
