# DECISIONS

2026-02-15: Choose initial tech stack (backend-first REST API)
Decision: Node.js + TypeScript + Fastify + SQLite + Vitest
Reason: fastest iteration + strong typing + clean layering + minimal ops
Alternatives: Python + FastAPI + pytest; Node + Express
Tradeoffs: TS adds build step; SQLite not for horizontal scaling

2026-02-15: Defer npm audit force upgrade (vitest major bump)
Decision: 暂不 npm audit fix --force，等核心 API + tests 建好后再升级
Reason: 避免破坏性升级；目前仅 dev 依赖风险
Plan: 等 /health + API tests 就位后，升级到 vitest v4 并复跑全套

2026-02-15: AppError + global Fastify error handler for API errors
Decision: use AppError + global Fastify error handler for consistent API errors
Reason: keep routes thin; avoid scattered string matching; ensure API.md compliance
Tradeoff: need to map domain errors to AppError codes

2026-02-15: Centralize API error handling (AppError + Fastify error handler)
Decision: Use AppError(code,statusCode,message) in service/router layers and handle errors via a global Fastify setErrorHandler returning docs/API.md format.
Reason: Keep routes thin, avoid scattered string matching, ensure consistent error responses, and make tests assert semantics (code/status) instead of message text.
Alternatives: Per-route try/catch mapping; plain Error messages; adding a validation library first.
Tradeoffs: Requires mapping domain errors to AppError; need to be disciplined about throwing AppError for expected failures.

2026-02-15: Use Fastify schema validation for request bodies
Decision: Validate POST/PUT /items bodies via Fastify route schema (JSON schema) and map validation failures to 400 BAD_REQUEST with docs/API.md error format.
Reason: Remove duplicated manual validation, ensure consistent behavior, and keep routes thin.
Alternatives: Manual typeof checks; external validation libs (zod/yup); validate in service layer.
Tradeoffs: Validation error details are not exposed (by design); schema must be kept in sync with API expectations.

2026-02-15: Pagination for GET /items with stable ordering
Decision: Support limit/offset pagination for GET /items with defaults (limit=20, offset=0) and max limit=100. Return total and page metadata. Use stable ordering by created_at then rowid to avoid non-deterministic pagination.
Reason: Prevent duplicate/missing items across pages and make tests/behavior deterministic under same-timestamp inserts.
Alternatives: Add an explicit autoincrement sequence column; order by created_at then a monotonic ULID; cursor-based pagination.
Tradeoffs: rowid is SQLite-specific; if migrating DB engines later, ordering must be revisited (recommend explicit seq or ULID then).

2026-02-15: Centralize HTTP response shapes in helpers
Decision: Use shared helpers (ok/err/unauthorized/badRequest/internalError) to generate all API response bodies.
Reason: Prevent drift in success/error shapes across routes and keep route handlers focused on business logic.
Alternatives: Inline objects per route; Fastify reply decorators.
Tradeoffs: Helper module becomes a shared dependency; must keep helpers aligned with docs/API.md.

2026-02-15: Studio 全链路中文化
Decision: /ui 与 /studio 使用 lang="zh-CN"；/studio 全部 UI 文案中文；POST /analyze 的 podcastOutline 生成文本全部中文；英文 scifi hooks 采用「原文」—— 中文解读 混合形式，UI 中标注「引用原文」。
Reason: 页面语言识别与用户体验一致；播客大纲以中文为主。
Tradeoffs: 分类/机制名仍来自英文 catalog，嵌入中文句子中。

2026-02-15: Studio 三步工作流（Analyze → Select → Expand）
Decision: POST /analyze 仅返回候选（categories, scifiMatches, mechanismMatches），不生成大纲；新增 POST /expand 根据勾选的分类与作品生成剧情支撑卡片（≥3 条）；每条卡片含 scene_title, story_summary, reality_mapping, usable_questions, quoted_original；UI 改为左侧控制台 + 右侧 Tabs（剧情支撑/大纲/证据链），含 loading、empty state、toast。
Reason: 用户先选再展开，控制生成范围；剧情支撑卡片可支撑播客内容。
Tradeoffs: 大纲/证据链 Tab 暂为占位，待后续实现。

2026-02-15: Studio 推荐路径 + 全中文 + 证据链
Decision: analyze 返回 recommendedTracks（≥2 条），每条含 trackId、中文 title、confidence、categories、mechanisms、scifiCandidates（中文简介）、whyThisTrack；用户点选 track 自动带入；expand 返回 plotSupportCards（scene_title_cn、plot_summary_cn、mapping_cn、podcast_question_cn 全中文，source_quote_en 可选折叠）；podcastOutline、evidenceChain 落地；作品名用 TITLE_ZH 映射为中文。
Reason: 用户不能凭空选小说；输出全中文；证据链展示分类、机制、引用。

2026-02-15: /analyze 返回 podcastOutline + evidenceChain 可验收
Decision: /analyze 直接返回 podcastOutline（opening_hook、framing、debate、analogy_scenarios、counterexamples、closing）与 evidenceChain（categories、mechanisms、scifiRefs 含 title_cn、hook_cn、quote_en）；Studio 分析完成后即渲染大纲与证据链；tests/studio.contract.test.ts 独立验收 API 与 UI。
Reason: 播客大纲与证据链必须可完整渲染，不能依赖 expand。

2026-02-15: Studio 分析系统代码质量升级（安全 + 自洽 + 可维护）
Decision: (1) UI 安全：集中封装 escapeHtml，studio/ui 注入 ESCAPE_HTML_BROWSER，所有动态内容经 esc() 转义后拼入 innerHTML；(2) 证据链可追溯：禁止「相关作品」占位，scifiRefs 仅含 TITLE_ZH 有映射的作品，plotSupportCards 必含 source_title_cn 且来自 evidenceChain；(3) 拆分 analyzeService：catalog/outline/evidence/tracks/plotCards 分离，主文件 <250 行；(4) 新增 security.ui、evidence.coherence、analyze.quality 测试。
Reason: 防止 XSS、保证证据链自洽、提升可维护性、测试驱动防回退。

2026-02-15: 禁止动态 innerHTML + view layer + CSP + source_id
Decision: (1) 禁止动态 innerHTML，仅允许静态模板骨架；(2) Studio/UI 渲染抽成 view layer（src/lib/view/domBuilders.ts），每个 section 用 DOM builder（createElement + textContent）；(3) 新增 tests/dom.render.test.ts 验证渲染后 DOM 不含 <script，用户输入只进 textContent；(4) CSP Header：script-src 'self' 禁止 inline script，脚本移至 /assets/studio.js、/assets/ui.js；(5) 证据链完整性：每张 plot card 必含 source_id（稳定引用，catalog title），evidence.coherence 测试升级为 source_id 校验。
Reason: 彻底消除 innerHTML 拼接风险，CSP 强制外部脚本，source_id 替代 title 匹配实现稳定追溯。
