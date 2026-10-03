/**
 * Domain/application error hierarchy.
 *
 * Business modules throw `AppError` (or a subclass) to describe an expected
 * failure. Anything else that reaches the global exception filter is treated as
 * an unexpected defect: it is logged with a stack trace and reported to the
 * client as a generic `INTERNAL_ERROR`, so database errors, stack traces and
 * internal identifiers can never leak to an end user.
 */

import type { ApiErrorCode, ApiFieldError } from '@hris/shared-types';

import { HttpStatus } from '@nestjs/common';

export interface AppErrorOptions {
  readonly details?: readonly ApiFieldError[];
  /** Underlying cause. Logged server-side, never serialised to the client. */
  readonly cause?: unknown;
  /** Extra server-side context for logs only. */
  readonly context?: Readonly<Record<string, unknown>>;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly details?: readonly ApiFieldError[];
  public readonly context?: Readonly<Record<string, unknown>>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: ApiErrorCode,
    options: AppErrorOptions = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = options.details;
    this.context = options.context;
    this.isOperational = true;
    Error.captureStackTrace(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'The request payload failed validation', details?: readonly ApiFieldError[]) {
    super(message, HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', { details });
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication is required') {
    super(message, HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, HttpStatus.FORBIDDEN, 'FORBIDDEN');
  }
}

/**
 * Raised when the caller is authenticated and authorised for the action but the
 * target record lies outside their data scope.
 *
 * It is deliberately distinct from `ForbiddenError` so that monitoring can
 * detect cross-entity access attempts, which are a meaningful security signal
 * in a multi-tenant platform.
 */
export class OutOfScopeError extends AppError {
  constructor(message = 'The requested record is outside your permitted data scope') {
    super(message, HttpStatus.FORBIDDEN, 'OUT_OF_SCOPE');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found') {
    super(message, HttpStatus.NOT_FOUND, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'The request conflicts with the current state of the resource') {
    super(message, HttpStatus.CONFLICT, 'CONFLICT');
  }
}

export class PreconditionFailedError extends AppError {
  constructor(message = 'A precondition for this operation was not met') {
    super(message, HttpStatus.PRECONDITION_FAILED, 'PRECONDITION_FAILED');
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'The request was understood but could not be processed', details?: readonly ApiFieldError[]) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, 'UNPROCESSABLE_ENTITY', { details });
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests. Please retry later') {
    super(message, HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED');
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'A required dependency is currently unavailable') {
    super(message, HttpStatus.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE');
  }
}

/** Type guard used by the global exception filter. */
export const isAppError = (value: unknown): value is AppError => value instanceof AppError;