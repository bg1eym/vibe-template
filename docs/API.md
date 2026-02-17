# API

Success response:
{ "success": true, "data": {} }

Error response:
{ "success": false, "error": { "code": "ERROR_CODE", "message": "message" } }

Endpoints:

- GET /health
- GET /items (query: q, tag, limit, offset)
- POST /items (body: title, content, tags?)
- GET /items/:id
- PUT /items/:id
- DELETE /items/:id
- POST /analyze (body: text) — 规则分析
- POST /expand (body: text, selectedTrackId, …) — 展开剧情支撑
- POST /analyze_ai (body: text) — AI 分析，需 Authorization
- POST /match_scifi_ai (body: analysis, selected_points?) — AI 科幻匹配，需 Authorization
