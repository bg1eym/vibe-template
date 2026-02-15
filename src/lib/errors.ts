export type ErrorBody = {
  success: false;
  error: { code: string; message: string };
};

export class AppError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, statusCode: number, message: string) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function toErrorBody(code: string, message: string): ErrorBody {
  return { success: false, error: { code, message } };
}

export function isAppError(err: unknown): err is AppError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    "statusCode" in err &&
    err instanceof Error
  );
}
