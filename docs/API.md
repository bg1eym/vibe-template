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
