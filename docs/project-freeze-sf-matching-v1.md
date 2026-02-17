# Project Freeze Snapshot: sf-matching-v1-stable

## 当前分支名

- `chore/audit-fix`

## 最近 5 条 commit

```text
58db776 feat: Studio/UI 工程化 - DOM builder, CSP, view layer, evidence source_id
d1628b1 chore: audit fix + lint/openapi/docs
ac24de3 chore: add prettier+eslint and check scripts
a616b67 feat: serve minimal OpenAPI at /openapi.json and docs page
2321959 chore: upgrade vitest to v4 to fix esbuild audit
```

## 当前 golden 目录文件列表

```text
(未找到 golden 目录或文件)
```

## 当前 pipelines 文件列表

```text
tests/match_scifi_ai.pipeline.test.ts
```

## 当前 eval_report.json 内容

```text
(未找到 eval_report.json)
```

## 当前 package.json scripts 列表

```json
{
  "dev": "tsx watch src/index.ts",
  "build": "tsc -p tsconfig.json && npm run build:client",
  "test": "vitest run",
  "test:watch": "vitest",
  "openapi:gen": "tsx scripts/gen-openapi.ts",
  "fmt": "prettier --write \"**/*.{ts,js,json,md}\"",
  "fmt:check": "prettier --check \"**/*.{ts,js,json,md}\"",
  "lint": "eslint .",
  "check": "npm run build && npm test && npm run fmt:check && npm run lint",
  "build:client": "tsx scripts/build-client.ts"
}
```

## 生成时间（UTC）

- `2026-02-17T09:00:00Z`
