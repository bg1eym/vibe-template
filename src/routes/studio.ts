import type { FastifyInstance } from "fastify";

const CSP = "script-src 'self'; object-src 'none'; base-uri 'self'";

const STUDIO_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="script-src 'self'; object-src 'none'; base-uri 'self'" />
  <title>工作室</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, "PingFang SC", sans-serif; margin: 0; background: #f8fafc; }
    .layout { display: flex; min-height: 100vh; }
    .sidebar { width: 340px; min-width: 300px; background: #fff; border-right: 1px solid #e2e8f0; padding: 20px; overflow-y: auto; }
    .main { flex: 1; padding: 20px; overflow-y: auto; }
    .section { margin-bottom: 20px; }
    .section-title { font-weight: 600; font-size: 0.9rem; color: #334155; margin-bottom: 8px; }
    input[type="text"], textarea { width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; }
    textarea { min-height: 100px; resize: vertical; }
    button { padding: 10px 16px; border-radius: 8px; font-size: 14px; cursor: pointer; border: none; }
    .btn-primary { background: #3b82f6; color: #fff; }
    .btn-primary:hover { background: #2563eb; }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
    .btn-secondary { background: #e2e8f0; color: #334155; }
    .btn-secondary:hover { background: #cbd5e1; }
    .track-card { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 10px; cursor: pointer; transition: all 0.15s; }
    .track-card:hover { border-color: #94a3b8; }
    .track-card.selected { border-color: #3b82f6; background: #eff6ff; }
    .track-card-title { font-weight: 600; color: #1e293b; margin-bottom: 6px; }
    .track-card-meta { font-size: 0.8rem; color: #64748b; margin-bottom: 6px; }
    .track-card-why { font-size: 0.85rem; color: #475569; }
    .tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
    .tab { padding: 10px 16px; background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; cursor: pointer; color: #64748b; font-size: 14px; }
    .tab.active { color: #3b82f6; border-bottom-color: #3b82f6; font-weight: 500; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
    .card-title { font-weight: 600; color: #1e293b; margin-bottom: 8px; }
    .card-field { margin-bottom: 10px; }
    .card-field-label { font-size: 0.8rem; color: #64748b; margin-bottom: 4px; }
    .quote-toggle { font-size: 0.8rem; color: #64748b; cursor: pointer; margin-top: 6px; }
    .quote-content { font-size: 0.85rem; color: #94a3b8; margin-top: 4px; padding: 8px; background: #f8fafc; border-radius: 6px; display: none; }
    .quote-content.open { display: block; }
    .evidence-item { padding: 12px; border-bottom: 1px solid #e2e8f0; }
    .evidence-ref { margin-bottom: 6px; }
    .evidence-item:last-child { border-bottom: none; }
    .evidence-label { font-size: 0.8rem; color: #64748b; margin-bottom: 4px; }
    .outline-p { margin-bottom: 12px; }
    .error { color: #dc2626; background: #fef2f2; padding: 10px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
    .empty { text-align: center; padding: 48px 24px; color: #94a3b8; font-size: 14px; }
    .loading { display: flex; align-items: center; justify-content: center; padding: 48px; color: #64748b; }
    .spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; background: #1e293b; color: #fff; border-radius: 8px; font-size: 14px; z-index: 1000; animation: fadeIn 0.2s; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <h2 style="margin: 0 0 20px; font-size: 1.25rem;">工作室</h2>
      <div class="section">
        <div class="section-title">令牌</div>
        <input id="token" type="text" placeholder="user_xxx 或 owner-id" />
      </div>
      <div class="section">
        <div class="section-title">步骤 1：分析</div>
        <textarea id="text" placeholder="粘贴要分析的文本片段…"></textarea>
        <div style="margin-top: 10px;">
          <button id="analyze" class="btn-primary">分析</button>
        </div>
      </div>
      <div id="tracks-section" class="section" style="display:none">
        <div class="section-title">步骤 2：选择推荐路径</div>
        <div id="tracks-list"></div>
      </div>
      <div id="expand-section" class="section" style="display:none">
        <div class="section-title">步骤 3：展开</div>
        <button id="expand" class="btn-secondary">生成剧情支撑</button>
      </div>
      <div id="error" class="error" style="display:none"></div>
    </aside>
    <main class="main">
      <div class="tabs">
        <button class="tab active" data-tab="cards">剧情支撑</button>
        <button class="tab" data-tab="outline">播客大纲</button>
        <button class="tab" data-tab="evidence">证据链</button>
      </div>
      <div id="tab-cards" class="tab-content active">
        <div id="cards-empty" class="empty">先完成分析，选择一条推荐路径，再点击「生成剧情支撑」。</div>
        <div id="cards-loading" class="loading" style="display:none"><div class="spinner"></div></div>
        <div id="cards-list" style="display:none"></div>
      </div>
      <div id="tab-outline" class="tab-content">
        <div id="outline-empty" class="empty">播客大纲包含：开场、框架、辩论、类比场景、反例、收尾。完成分析后自动展示。</div>
        <div id="outline-content" style="display:none"></div>
      </div>
      <div id="tab-evidence" class="tab-content">
        <div id="evidence-empty" class="empty">证据链展示：分类、机制、引用作品（含 hook 摘要）。完成分析后自动展示。引用原文默认折叠。</div>
        <div id="evidence-content" style="display:none"></div>
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
