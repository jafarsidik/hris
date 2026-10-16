import type { NextFunction, Request, Response } from 'express';

import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';

import { ApiUsageService } from './api-usage.service';

interface UsageRequest extends Request {
  readonly correlationId?: string;
  readonly apiClientId?: string;
  readonly apiClientCompanyId?: string;
}

/**
 * Records one row per developer-API request.
 *
 * The row is written on the response's `finish` event rather than from an interceptor,
 * because that is the first point at which the final status code is known: the exception
 * filter has already turned a thrown error into its response by then, so a failed request
 * is recorded with the status the client actually saw. Only requests authenticated with an
 * API key are recorded — the ids are stamped by the authentication guard — and only the
 * path is stored, never the query string, which can carry personal data.
 *
 * Writing must never affect the response, so a failure to record is swallowed; the request
 * has already been answered by this point and a usage gap is preferable to a broken call.
 */
@Injectable()
export class ApiUsageMiddleware implements NestMiddleware {
  constructor(@Inject(ApiUsageService) private readonly usage: ApiUsageService) {}

  use(request: UsageRequest, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();

    response.on('finish', () => {
      const apiClientId = request.apiClientId;
      const companyId = request.apiClientCompanyId;
      if (apiClientId === undefined || companyId === undefined) {
        return;
      }

      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      void this.usage
        .record({
          companyId,
          apiClientId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          durationMs: Math.max(0, Math.round(durationMs)),
          ...(request.correlationId === undefined ? {} : { correlationId: request.correlationId }),
        })
        .catch(() => {
          // A usage write is best-effort; the response is already on the wire.
        });
    });

    next();
  }
}
