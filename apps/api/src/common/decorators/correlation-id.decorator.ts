import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Injects the correlation id assigned by {@link CorrelationIdMiddleware}.
 *
 * Controllers that emit audit records or notifications include it so a single
 * identifier can be used to trace an action end to end.
 */
export const CorrelationId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const request = context.switchToHttp().getRequest<Request & { correlationId?: string }>();
    return request.correlationId;
  },
);
