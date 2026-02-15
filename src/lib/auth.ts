import type { FastifyReply, FastifyRequest } from "fastify";

function parseBearerOwnerId(authHeader: unknown): string | null {
  if (typeof authHeader !== "string") return null;
  const m = authHeader.match(/^Bearer\s+user_(.+)$/i);
  if (!m) return null;
  const id = m[1]?.trim();
  return id ? id : null;
}

function parseLegacyOwnerId(xOwnerId: unknown): string | null {
  if (typeof xOwnerId !== "string") return null;
  const id = xOwnerId.trim();
  return id ? id : null;
}

/** Returns token string for Authorization: Bearer <token>. Used in tests. */
export function bearerTokenForUser(ownerId: string): string {
  return `user_${ownerId}`;
}

export function getOwnerId(req: FastifyRequest): string | null {
  const bearer = parseBearerOwnerId(req.headers.authorization);
  if (bearer) return bearer;

  const legacy = parseLegacyOwnerId(req.headers["x-owner-id"]);
  if (legacy) return legacy;

  return null;
}

export function requireOwner(req: FastifyRequest, reply: FastifyReply) {
  const ownerId = getOwnerId(req);
  if (!ownerId) {
    return reply.code(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "missing authorization" },
    });
  }
  req.ownerId = ownerId;
}
