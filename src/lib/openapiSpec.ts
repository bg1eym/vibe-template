export const OPENAPI_SPEC = {
  openapi: "3.0.3",
  info: {
    title: "vibe-template API",
    version: "0.1.0",
  },
  servers: [{ url: "http://127.0.0.1:3000" }],
  components: {
    schemas: {
      Item: {
        type: "object",
        properties: {
          id: { type: "string" },
          owner_id: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          created_at: { type: "string" },
          updated_at: { type: "string" },
        },
      },
    },
    securitySchemes: {
      bearerPlaceholder: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "user_<USER_ID>",
      },
    },
  },
  paths: {
    "/health": {
      get: {
        responses: {
          "200": { description: "OK" },
        },
      },
    },
    "/items": {
      get: {
        security: [{ bearerPlaceholder: [] }],
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0 } },
          {
            name: "q",
            in: "query",
            schema: { type: "string" },
            description: "Search in title/content (case-insensitive)",
          },
          { name: "tag", in: "query", schema: { type: "string" }, description: "Filter by tag" },
        ],
        responses: {
          "200": { description: "List items" },
          "401": { description: "Unauthorized" },
        },
      },
      post: {
        security: [{ bearerPlaceholder: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["title", "content"],
                properties: {
                  title: { type: "string", minLength: 1 },
                  content: { type: "string", minLength: 1 },
                  tags: { type: "array", items: { type: "string" }, description: "Optional tags" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
          "400": { description: "Bad Request" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/items/{id}": {
      get: {
        security: [{ bearerPlaceholder: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Get item" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "404": { description: "Not Found" },
        },
      },
      put: {
        security: [{ bearerPlaceholder: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Updated" },
          "400": { description: "Bad Request" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "404": { description: "Not Found" },
        },
      },
      delete: {
        security: [{ bearerPlaceholder: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Deleted" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "404": { description: "Not Found" },
        },
      },
    },
  },
} as const;
