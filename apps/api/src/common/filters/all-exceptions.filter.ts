import { randomUUID } from 'node:crypto';

import {
  Catch,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { ApiError, ApiErrorCode } from '@hris/shared-types';
import type { Request, Response } from 'express';

import { isAppError } from '../errors/app-error';

/** Maps an HTTP status onto the stable client-facing error code. */
const STATUS_TO_ERROR_CODE: Readonly<Record<number, ApiErrorCode>> = Object.freeze({
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PRECONDITION_FAILED]: 'PRECONDITION_FAILED',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.NOT_IMPLEMENTED]: 'NOT_IMPLEMENTED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
});

const GENERIC_MESSAGES: Readonly<Partial<Record<number, string>>> = Object.freeze({
  [HttpStatus.BAD_REQUEST]: 'The request could not be understood',
  [HttpStatus.UNAUTHORIZED]: 'Authentication is required',
  [HttpStatus.FORBIDDEN]: 'You do not have permission to perform this action',
  [HttpStatus.NOT_FOUND]: 'The requested resource was not found',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests. Please retry later',
});

const toErrorCode = (statusCode: number): ApiErrorCode =>
  STATUS_TO_ERROR_CODE[statusCode] ?? 'INTERNAL_ERROR';

/**
 * Last line of defence for every unhandled exception.
 *
 * Contract:
 * - Expected failures (`AppError`) are returned verbatim: their message is
 *   written to be safe for display.
 * - Everything else is logged with its stack trace and replaced by a generic
 *   `INTERNAL_ERROR` response, so database messages, stack traces, file paths,
 *   driver errors and secrets can never reach a client.
 */
@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { correlationId?: string }>();
    const response = http.getResponse<Response>();

    const { statusCode, error } = this.resolve(exception);

    const logContext = {
      correlationId: request.correlationId,
      method: request.method,
      path: request.path,
      statusCode,
      ip: request.ip,
      ...error.internalContext,
    };

    if (statusCode >= 500) {
      this.logger.error(
        { ...logContext, error: exception instanceof Error ? exception.stack : String(exception) },
        'Unhandled exception',
      );
    } else if (statusCode === HttpStatus.UNAUTHORIZED || statusCode === HttpStatus.FORBIDDEN) {
      this.logger.warn(logContext, 'Request denied');
    } else {
      this.logger.warn(logContext, 'Request failed');
    }

    const payload: ApiError = {
      code: error.code,
      message: error.message,
      details: error.details,
      correlationId: request.correlationId,
    };

    response.status(statusCode).json({ success: false, error: payload });
  }

  private resolve(exception: unknown): {
    statusCode: number;
    error: {
      code: ApiErrorCode;
      message: string;
      details?: ApiError['details'];
      internalContext?: Record<string, unknown>;
    };
  } {
    if (isAppError(exception)) {
      return {
        statusCode: exception.statusCode,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
          internalContext: exception.context,
        },
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      return {
        statusCode,
        error: {
          code: toErrorCode(statusCode),
          // HttpException messages are authored by this codebase and are safe.
          message: exception.message || (GENERIC_MESSAGES[statusCode] ?? 'The request failed'),
          internalContext: { exceptionName: exception.name },
        },
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please contact support with the correlation id.',
        internalContext: {
          exceptionName: exception instanceof Error ? exception.name : typeof exception,
          incidentId: randomUUID(),
        },
      },
    };
  }
}
