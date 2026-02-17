# DECISIONS

2026-02-15: Signal → Mechanism → Trope 最小闭环（可解释 + 可迭代）
Decision: 在 /analyze_ai 产出中引入机制层（mechanisms[] 命中：point_id, mechanism_id, why_this_mechanism_cn, evidence_quote_cn），并在 Studio UI 增加 Process Trace（points → mechanisms → candidates）面板；匹配阶段保留人类反馈闭环（keep/reject/boost + rerank/improve/expand）。
Reason: 仅有候选列表会让用户“看不到推理过程”，无法稳定判断下一步；机制层让“观点抽取→匹配路由”可解释、可核验。
Tradeoffs: 机制命中先采用轻量规则/单次 LLM 输出，准确率不是本迭代目标；先保证结构化与交互闭环，再迭代质量。

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

2026-02-15: CSS 工程化，保持 style-src 'self' 不放开 unsafe-inline
Decision: (1) 将 /studio、/ui 的 CSS 移至 src/client/studio.css、src/client/ui.css；(2) build:client 产出 dist/public/studio.css、ui.css；(3) HTML 用 <link rel="stylesheet" href="/assets/studio.css"> 引入；(4) 保持 CSP style-src 'self'；(5) 所有显示/隐藏用 classList 控制（.visible、.hidden、.open），chart bar 高度用 .h-0～.h-100 类（5% 步长），禁止 JS 设置 element.style。
Reason: 不放开 unsafe-inline，更安全；CSS 与 HTML/JS 分离，可维护。

2026-02-15: match_scifi_ai 全中文输出自愈（repair pass）
Decision: 当 validator 报「中文字段禁止含英文字母」时，触发 repair pass：将原始 matches JSON 发给 LLM 做「去英文化改写」，再 validate。Validator 报错增强为含 field path 与 latin snippet（如 matches[0].mapping_cn contains latin letters: "...AI..."）。
Reason: 真实 LLM 常在中文字段夹带 AI/EHR/GPT 等拉丁字母，导致 503；repair 自愈可保证最终返回全中文，减少 UI 503。

2026-02-15: match_scifi_ai 从 Hard Gate 改为 Audit Pipeline（Human Review）
Decision: (1) /match_scifi_ai 不再对质量问题（quote_en 不在 hooks、source_id 不在 catalog、长度不足、缺机制名、缺剧情标签、含拉丁字母）返回 503，改为返回 200 + audit.issues（每条含 path/severity/reason/fix_instruction）。(2) 唯一阻断（503）条件：JSON 解析失败、无 matches 数组（结构性错误）。(3) 删除 matchScifiAi 内的多阶段自动 repair 循环，简化为：生成→审稿→返回。(4) 新增 POST /repair_match_scifi_ai 路由，接收 draft + issues + analysis，调用 LLM 定向修补后返回新结果 + 新 audit。(5) quote_en 校验降级为 warn，不再阻断。(6) source_id 不在 catalog 降级为 warn。(7) 删除旧的 mechanism_repair/length_repair/source_id_repair 测试，新增 no_block_on_quote/no_block_on_source_id 测试 + repair 路由测试。
Reason: catalog 是 soft grounding（提升质量的提示），不是 hard gate（验收门槛）。真实 LLM 产出有不确定性，用审稿代替拒绝可保证 UI 总能拿到"剧情支撑草稿"，再由人工或 repair 路由做定向修正。
Alternatives: 继续用 hard gate + 多阶段 auto-repair（复杂、脆弱、真实 key 下仍有概率 503）。
Tradeoffs: 前端需要展示 audit issues 来提示用户哪些字段需要人工审核；审稿质量依赖 issue 描述的清晰度。

2026-02-15: match_scifi_ai 升级为 Multi-pass Generate → Audit → Curate → Expand Pipeline
Decision: (1) /match_scifi_ai 改为多轮 LLM 调用：Step A Generate（生成 20+ 候选）→ Step B Audit（LLM 当"制片人"逐条评分 5 维度）→ Step C Curate（服务端加权排序 + 多样性约束）→ Step D Expand（质量不够时自动补充，最多 2 轮）。(2) 新增类型：MatchCandidate（候选层）、AuditScore（5 维评分）、AuditedCandidate（审核后候选）。(3) 评分维度：relevance(×3)、mechanism_fit(×2)、specificity(×2)、human_plausibility(×2)、novelty(×1)，加权总分决定排序。(4) 多样性约束：同一作品 TopK 中不超过 2 条；不够多样时放宽。(5) 新增 POST /match_scifi_ai_expand（补充新候选）和 POST /match_scifi_ai_rerank（重新审核排序）。(6) UI 升级：每条卡片显示 score badges + verdict badge + 审核意见折叠；新增"补充更多候选"/"重新审核"/"只看保留"/"按分数排序"/"按新颖度排序"按钮。(7) 保留旧的服务端质量检查（长度/markers/机制名/拉丁字母/source_id/quote_en），作为 audit.issues 继续输出。(8) 新增 tests/match_scifi_ai.pipeline.test.ts 覆盖数量/多轮/多样性/打分回归；dom.render.test 覆盖 renderAuditedMatchCard + renderAuditSummary。
Reason: 单轮生成质量不稳定，多轮 pipeline 可以（a）生成更多候选供筛选（b）用 LLM 做"节目制片人判断"增加可解释性（c）自动扩展补充多样性（d）给用户提供分数/理由辅助决策。
Alternatives: 单轮生成 + 纯服务端规则打分；引入 RAG/向量检索替代 catalog 匹配。
Tradeoffs: 多轮 LLM 调用增加延迟和成本（至少 2 次，最多 4 次）；LLM 评分本身有主观性；需要前端适配新的 AuditedCandidate 结构。

2026-02-15: match_scifi_ai 改为「快 + 可交互 + 不阻断」的多轮候选系统
Decision: (1) /match_scifi_ai 改为 FAST 模式：只做 1 次 LLM 调用（Generate Wide），不自动跑 audit/expand。返回 candidates[] + recommended_for_ui[]（≥12）+ audit（服务端规则审稿）+ pipeline（mode/llm_calls/steps）。(2) 审核和扩展必须显式触发：POST /match_scifi_ai_rerank（1 次 LLM 审核调用→打分+排序→matches[]）、POST /match_scifi_ai_expand（1 次 LLM 调用→补充新候选→merged candidates[]）。(3) MatchCandidate 结构重构：source_id/work_cn/author 收入 source 子对象：{ source: { source_id?, work_cn, author?, medium?, year? } }。(4) 任何质量问题（缺机制名/长度不足/缺markers/含拉丁字母/quote不可信/source_id不在catalog）永远不返回 success:false，全部进入 audit.issues[]。唯一 503：JSON 解析失败或无 candidates 字段。(5) 每个接口严格 1 次 LLM 调用，禁止隐式多轮循环。(6) Fake LLM 扩展到 25 个 catalog 条目，generate 返回 ≥20 candidates。(7) UI 适配：fast 模式渲染 renderCandidateCard（无分数）、rerank 后渲染 renderAuditedMatchCard（带分数 badges/verdict/审核意见折叠）、新增"补充更多候选"/"重新审核/重排"按钮。(8) 新增 tests: pipeline (fast/rerank/expand)、candidateCard DOM 渲染、所有旧测试适配 candidates 响应结构。
Reason: 之前的多轮 pipeline（2-4 次 LLM 调用）导致 /match_scifi_ai 太慢；用户需要先快速拿到候选再按需审核/扩展；source 子对象为未来扩展 medium/year 预留空间；严格 1 call/endpoint 保证性能可预测。
Alternatives: 保持多轮自动 pipeline（Generate→Audit→Expand 在一次请求内），streaming 返回中间结果。
Tradeoffs: fast 模式返回的候选无 LLM 评分，需要用户主动触发 rerank 才能看到分数/verdict；source 子对象的结构变更需要更新所有测试和 UI 代码。

2026-02-15: 人类反馈参与式候选精选（Human-in-the-Loop Feedback）
Decision: (1) 新增 HumanFeedback 类型（keep_ids/reject_ids/boost_ids/notes_by_id/desired_style），作为 rerank/expand/improve 的可选输入。(2) /match_scifi_ai_rerank 接受 feedback：reject 的候选永不进入 TopK，keep 保底入选（最多占半），boost 加分。Audit prompt 把反馈写入审稿要求。(3) /match_scifi_ai_expand 接受 feedback：避开 reject 候选的作品/母题，参考 keep/boost 偏好方向。(4) 新增 /match_scifi_ai_improve：只改写 target_ids 对应条目的 scene_cn/mapping_cn/why，保持其他候选不变，严格 1 次 LLM 调用。(5) UI 卡片增加 👍保留/👎不要/⭐很像/✏️让它更像 四个按钮，全局控制条增加"根据我的选择重排/精选""补充更多但更不一样""改进我选中的几条"。(6) 每次按钮点击严格 1 次 LLM 调用。
Reason: 让人类判断显式参与候选筛选，而非纯靠 LLM 评分。用户可以通过 keep/reject/boost 逐步收敛到满意的候选集。
Alternatives: 纯自动多轮迭代（无人参与）；前端只做过滤排序（不传回后端）。
Tradeoffs: 前端需管理 feedback 状态；每次 rerank/expand/improve 仍是 1 次 LLM 调用（不会变慢），但 prompt 更长（含反馈内容）。

2026-02-15: Studio UI "failed to fetch" 诊断改进 + 请求可追踪
Decision: (1) 前端所有 fetch 统一走 apiPost() wrapper：捕获网络错误、HTTP 错误、JSON 解析失败，始终展示 "POST /path 失败 (status=XXX): 响应摘要" 而非裸 "failed to fetch"。(2) 服务端每个请求生成 req_id（8 位 UUID），写入 response header x-req-id 和 JSON error body req_id 字段。(3) 全局 error handler 增强：所有异常返回 JSON（含 req_id），console.error 带 [req_id] 前缀。(4) 新增 onResponse hook 对 4xx/5xx 记录 req_id + method + url + status + elapsed。(5) 新增 tests/studio.smoke.match.test.ts：端到端冒烟测试 analyze_ai → match_scifi_ai → rerank，断言 200 + x-req-id；401/503/400 都返回 JSON + req_id（不会连接断开）。
Reason: "failed to fetch" 无法定位是前端路径错误、auth 拦截、后端 crash 还是 JSON 序列化失败。req_id 让前后端日志可对应。统一 error wrapper 让任何失败都有上下文。
Alternatives: 使用 Fastify 内置 logger（pino）；前端使用 axios 等库自带错误处理。
Tradeoffs: 错误响应 body 新增 req_id 字段，已有的 toEqual 断言需改为 toMatchObject。

2026-02-16: 引入 Viewpoint 大库 + Claim→Viewpoint→Candidate 三阶段可解释算法（不增加 LLM 调用）
Decision: (1) 新增 `viewpointLibrary`（>=200 条），字段包含 vp_id/definition/diagnostic_questions/evidence_patterns/routing_intents/related_mechanism_ids/examples，并提供可复用校验器；(2) `/analyze_ai` 保持 1 次 LLM 调用，但结构化输出增强为 claims + vp_candidates + vp_pick，并在服务端补齐规则分解 `vp_score_breakdown`；(3) `/match_scifi_ai_rerank` 在 1 次 LLM 审核内带入 top claims + vp 定义 + feedback，仅做重排和理由，不生成新候选；(4) UI process-trace 增加 claim→vp→score 分解可视化，候选卡增加“匹配内容/新闻证据句”折叠块。
Reason: 仅靠机制层不足以支撑“可生产扩展”和“稳定可解释重排”；观点库提供更细粒度路由单位，规则打分补足可诊断性，同时维持端点 llm_calls=1 的性能约束。
Alternatives: 新增二次 LLM 进行观点检索或语义重写；直接引入向量检索服务。
Tradeoffs: 规则分目前是轻量弱规则（关键词+机制重合），解释性强但语义覆盖有限；后续可继续扩库并迭代打分权重。
