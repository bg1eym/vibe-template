# vibe-template Cursor Contract (Agent Rules)

This repository uses Cursor/Claude as an assistant, but the codebase must remain consistent, testable, and maintainable.

## Files policy

- `CLAUDE.md`: Project rules entry (high-level constraints only).
- **禁止提交 bundle 产物**：`dist/public/*.js`、`public/*.js` 为构建输出，不得入库。`.gitignore` 已包含 `dist/`、`public/`。

## Security rules (UI / CSP / build)

- **禁止在 UI 中拼接动态 innerHTML**：用户输入与 API 返回必须通过 `textContent`、`createElement` 或统一 `escapeHtml()` 渲染。
- **CSP 必须存在且字段完整**：所有 HTML 页面（/studio、/ui）必须返回 `Content-Security-Policy` Header，且包含：`default-src 'self'`、`script-src 'self'`、`style-src 'self'`、`img-src 'self' data:`、`object-src 'none'`、`base-uri 'self'`、`frame-ancestors 'none'`。
- **改 client TS 必须能被 build:client 捕捉到**：修改 `src/client/*.ts` 后必须运行 `npm run build:client`（或 `npm run build`）重新生成 `dist/public/*.js`。`./scripts/check-all.sh` 会在 build 阶段自动执行。
- `docs/CURSOR_CONTRACT.md`: Cursor execution spec (commands, steps, acceptance).
- `docs/openapi.json`: Generated artifact. Update only via `npm run openapi:gen`. Do not edit manually. If any formatting causes a diff, the output of `npm run openapi:gen` is the canonical version.

## 0) Mandatory startup checklist (always do this first)

Before making any changes:

1. Read `CLAUDE.md`
2. Read `docs/CURSOR_CONTRACT.md`
3. Run `npm test` (or at least understand current test status)
4. Identify what files will be touched

If you cannot access these files, STOP and ask.

---

## 1) Core principles

- Do not guess project conventions. Read existing code first.
- Prefer minimal diffs over large refactors.
- Do not break tests.
- If you change behavior, update tests accordingly.
- If you change API behavior, you must also update the endpoint contract in this file (API Contract section).
- Always keep TypeScript types correct (no `any` unless explicitly allowed).
- Keep API responses consistent (`{ success: true, data: ... }` or `{ success: false, error: ... }`).

---

## 2) Build / test contract (non-negotiable)

After every change, you must run:

```bash
npm run fmt
./scripts/check-all.sh
```

In Cursor/sandbox environments, prefix npm commands with `env -u npm_config_devdir` to avoid the npm devdir warning (e.g. `env -u npm_config_devdir npm test`, `env -u npm_config_devdir ./scripts/check-all.sh`).

---

## API Contract (Executable)

Envelope: success `{ success: true, data }`, error `{ success: false, error: { code, message } }`.

### GET /health

- 200: `{ success: true, data: { status: "ok" } }`
- (tests/health.test.ts)

### GET /items

- 200: `{ success: true, data: { page: { limit, offset, total }, items } }`; default limit=20, offset=0
- Query: `q` (search title/content), `tag` (filter by tag), `limit`, `offset`
- 401: `{ success: false, error: { code: "UNAUTHORIZED", message } }`
- (tests/items.routes.test.ts)

### POST /items

- 201: `{ success: true, data: { item } }`
- 400: `{ success: false, error: { code: "BAD_REQUEST", message } }`
- 401: `{ success: false, error: { code: "UNAUTHORIZED", message } }`
- Body: `{ title, content }` required, minLength 1; `tags` optional string[]
- (tests/items.routes.test.ts)

### GET /items/:id

- 404 when id not found; 403 when item exists but owner mismatch (do not hide existence).
- 200: `{ success: true, data: { item } }`
- 401: `{ success: false, error: { code: "UNAUTHORIZED", message } }`
- 403: `{ success: false, error: { code: "FORBIDDEN", message } }`
- 404: `{ success: false, error: { code: "ITEM_NOT_FOUND", message } }`
- (tests/items.routes.test.ts)

### PUT /items/:id

- 200: `{ success: true, data: { item } }`
- 400: `{ success: false, error: { code: "BAD_REQUEST", message } }`
- 401: `{ success: false, error: { code: "UNAUTHORIZED", message } }`
- 403: `{ success: false, error: { code: "FORBIDDEN", message } }`
- 404: `{ success: false, error: { code: "ITEM_NOT_FOUND", message } }`
- Body: `{ title, content }` required, minLength 1
- (tests/items.routes.test.ts)

### DELETE /items/:id

- 200: `{ success: true, data: { deleted: true } }`
- 401: `{ success: false, error: { code: "UNAUTHORIZED", message } }`
- 403: `{ success: false, error: { code: "FORBIDDEN", message } }`
- 404: `{ success: false, error: { code: "ITEM_NOT_FOUND", message } }`
- (tests/items.routes.test.ts)

### POST /analyze

- 200: `{ success: true, data: { categories, scifiMatches, mechanismMatches, recommendedTracks, podcastOutline, evidenceChain } }`
- recommendedTracks: array of ≥2; each track: `{ trackId, title, confidence, categories, mechanisms, scifiCandidates, whyThisTrack }` — all Chinese
- podcastOutline: `{ opening_hook, framing (≥2), debate: { thesis, antithesis, synthesis }, analogy_scenarios (≥2), counterexamples (≥2), closing }` — all Chinese
- evidenceChain: array; each `{ categories[], mechanisms[], scifiRefs[] }`; scifiRefs each `{ title_cn, hook_cn, quote_en? }`
- mechanismMatches: at least 2 entries
- 400/401: standard
- Body: `{ text }` required
- Auth: same as /items\*
- (tests/analyze.routes.test.ts, tests/studio.contract.test.ts)

### POST /expand

- 200: `{ success: true, data: { plotSupportCards, podcastOutline, evidenceChain } }`
- plotSupportCards: ≥3; each: `{ scene_title_cn, plot_summary_cn, mapping_cn, podcast_question_cn, source_quote_en? }` — Chinese-only except source_quote_en
- podcastOutline: `{ opening_cn, framing_cn, closing_cn }`
- evidenceChain: `{ categories, mechanisms, scifiRefs }` per item
- Body: `{ text }` required; `selectedTrackId`, `selectedCategories`, `selectedWorkTitles` optional
- Auth: same as /items\*
- (tests/analyze.routes.test.ts)

### docs/openapi.json

- Must match OPENAPI_SPEC. (tests/openapi.gen.test.ts)
