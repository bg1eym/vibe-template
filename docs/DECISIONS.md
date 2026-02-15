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
