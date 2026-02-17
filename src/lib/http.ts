export type OkBody<T> = { success: true; data: T };
export type ErrBody = { success: false; error: { code: string; message: string } };

export function ok<T>(data: T): OkBody<T> {
  return { success: true, data };
}

export function err(code: string, message: string): ErrBody {
  return { success: false, error: { code, message } };
}

export function unauthorized(message = "missing authorization") {
  return err("UNAUTHORIZED", message);
}

export function badRequest(message = "invalid request") {
  return err("BAD_REQUEST", message);
}

export function internalError() {
  return err("INTERNAL_ERROR", "internal error");
}

export function badUpstream(message = "upstream service error") {
  return err("BAD_UPSTREAM", message);
}
