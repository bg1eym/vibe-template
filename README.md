# vibe-template

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
