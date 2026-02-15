# vibe-template

> **NOTE FOR CURSOR/CLAUDE USERS**: Before modifying any code, read [docs/CURSOR_CONTRACT.md](docs/CURSOR_CONTRACT.md) first.

AI-assisted development template.

Dev:

- `npm run dev` 启动
- `curl http://127.0.0.1:3000/health` 验证

Workflow:
SPEC -> PLAN -> IMPLEMENT -> TEST -> REVIEW -> DOCUMENT -> REPEAT

Rules:

- Follow docs/SPEC.md
- Record decisions in docs/DECISIONS.md
- Always add tests
- Always propose a plan before changes

## Dev shortcuts

- Start dev server (watch):

  npm run dev

- Start dev server with automatic /health check (recommended):

  ./scripts/dev.sh

- Full local verification:

  ./scripts/check-all.sh

## API docs

- /docs
- /openapi.json
- docs/openapi.json (more detailed offline spec)

## UI

1. Start dev server: `npm run dev`
2. Open: http://127.0.0.1:3000/ui
3. Enter token (ownerId, e.g. `user_xxx` or just the id), then Query.

## Studio

1. Start dev server: `npm run dev`
2. Open: http://127.0.0.1:3000/studio
3. Enter token, paste text, click Analyze. View categories, sci-fi matches, podcast outline.
