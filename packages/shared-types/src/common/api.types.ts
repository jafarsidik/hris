/**
 * Standardised API envelope contracts.
 *
 * Every endpoint must respond with one of these two shapes so that clients
 * (web, mobile) can implement a single, exhaustive result handler
 * (ARCHITECTURE section 11).
 */

/** Stable, machine-readable error codes. Clients must branch on these, not on messages. */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'MFA_REQUIRED',
  'FORBIDDEN',
  'OUT_OF_SCOPE',
  'NOT_FOUND',
  'CONFLICT',
  'PRECONDITION_FAILED',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'UNPROCESSABLE_ENTITY',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  'NOT_IMPLEMENTED',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiFieldError {
  /** Dotted path of the offending field, e.g. `items.0.quantity`. */
  readonly field: string;
  readonly message: string;
  readonly constraint?: string;
}

export interface ApiError {
  readonly code: ApiErrorCode;
  /** Human-readable, safe to display. Never contains stack traces or SQL. */
  readonly message: string;
  readonly details?: readonly ApiFieldError[];
  /** Ties the client-visible error to the server-side log entry. */
  readonly correlationId?: string;
}

export interface ApiSuccessMeta {
  readonly correlationId?: string;
}

export interface ApiSuccessResponse<TData> {
  readonly success: true;
  readonly data: TData;
  readonly meta?: ApiSuccessMeta;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly error: ApiError;
}

export type ApiResponse<TData> = ApiSuccessResponse<TData> | ApiErrorResponse;

export function isApiSuccessResponse<TData>(
  response: ApiResponse<TData>,
): response is ApiSuccessResponse<TData> {
  return response.success;
}

export function isApiErrorResponse<TData>(
  response: ApiResponse<TData>,
): response is ApiErrorResponse {
  return !response.success;
}