export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; code: "UNAUTHORIZED"; message: string };

export function parseAuth(headers: Record<string, any>): AuthResult {
  const auth = headers["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    if (token.startsWith("user_")) {
      const userId = token.slice("user_".length).trim();
      if (userId.length > 0) return { ok: true, userId };
    }
    return { ok: false, code: "UNAUTHORIZED", message: "invalid token" };
  }

  // backward-compat: allow x-owner-id (temporary)
  const legacy = headers["x-owner-id"];
  if (typeof legacy === "string" && legacy.trim() !== "") {
    return { ok: true, userId: legacy.trim() };
  }

  return { ok: false, code: "UNAUTHORIZED", message: "missing authorization" };
}

export function bearerTokenForUser(userId: string) {
  return `user_${userId}`;
}
