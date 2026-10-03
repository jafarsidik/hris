import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiSuccessResponse } from '@hris/shared-types';

import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';

/**
 * Wraps every successful response in the standard envelope.
 *
 * Applying this centrally is what makes the response contract uniform: a
 * controller cannot accidentally return a bare object, and clients only need
 * one success shape to handle. Routes marked with `@RawResponse()` are skipped.
 */
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (
      this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request & { correlationId?: string }>();

    return next.handle().pipe(
      map((data): ApiSuccessResponse<unknown> => ({
        success: true,
        data: data ?? null,
        meta: request.correlationId ? { correlationId: request.correlationId } : undefined,
      })),
    );
  }
}
