import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Emits one structured access-log line per completed request.
 *
 * Request and response bodies are deliberately never logged: they routinely
 * contain employee PII, bank details and salary data. The path is logged
 * without its query string for the same reason (search terms and filters can
 * embed personal data).
 */
@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AccessLogInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { correlationId?: string }>();
    const response = http.getResponse<Response>();
    const startedAt = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => {
          this.write(request, response.statusCode, startedAt);
        },
        error: () => {
          this.write(request, response.statusCode, startedAt);
        },
      }),
    );
  }

  private write(
    request: Request & { correlationId?: string },
    statusCode: number,
    startedAt: bigint,
  ): void {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const line = {
      method: request.method,
      // `originalUrl` includes the query string, so only the path is recorded.
      path: request.path,
      statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      correlationId: request.correlationId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };

    if (statusCode >= 500) {
      this.logger.error(line, 'HTTP');
    } else if (statusCode >= 400) {
      this.logger.warn(line, 'HTTP');
    } else {
      this.logger.log(line, 'HTTP');
    }
  }
}
