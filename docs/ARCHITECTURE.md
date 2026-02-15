# ARCHITECTURE

Stack:
- Language: TypeScript (Node.js)
- Web: Fastify
- DB: SQLite
- Tests: Vitest

Folders:
- src/routes
- src/services
- src/db
- src/lib
- src/types
- tests

Rules:
- keep modules small
- separate business logic from IO/UI
- avoid global mutable state
- isolate side effects
