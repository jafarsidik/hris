import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { Injectable, type NestMiddleware } from '@nestjs/common';

/**
 * Maximum accepted length of an inbound correlation id.
 *
 * An unbounded value would be written verbatim into logs, so an attacker could
 * flood or forge log entries.
 */
const MAX_CORRELATION_ID_LENGTH = 64;

const SAFE_CORRELATION_ID = /^[A-Za-z0-9_-]+$/;

export interface RequestWithCorrelationId extends Request {
  correlationId: string;
}

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Returns the inbound correlation id when it is safe to echo, otherwise a
 * freshly generated one.
 *
 * Sanitising rather than trusting the header prevents log injection and
 * response-header splitting through log-correlation identifiers.
 */
export function resolveCorrelationId(inbound: unknown): string {
  if (typeof inbound !== 'string') {
    return randomUUID();
  }
  const candidate = inbound.trim();
  if (
    candidate.length === 0 ||
    candidate.length > MAX_CORRELATION_ID_LENGTH ||
    !SAFE_CORRELATION_ID.test(candidate)
  ) {
    return randomUUID();
  }
  return candidate;
}

/**
 * Assigns a correlation id to every request.
 *
 * The id ties a client-visible error response to the server-side log entry and
 * to any audit record written while handling the request.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: RequestWithCorrelationId, response: Response, next: NextFunction): void {
    const correlationId = resolveCorrelationId(request.headers[CORRELATION_ID_HEADER]);
    request.correlationId = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}