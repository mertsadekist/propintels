export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "RATE_LIMITED"
  | "TOKEN_INVALID"
  | "TOKEN_EXPIRED"
  | "INSUFFICIENT_DATA";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: unknown
) {
  return Response.json(
    { error: { code, message, details } },
    { status }
  );
}
