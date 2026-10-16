import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CallHandler } from '@nestjs/common';
import { type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { from, of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

import { withTenantContext } from '@hris/database';

import { ConflictError } from '../../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import crypto from 'node:crypto';

/**
 * Idempotency interceptor: replays a cached response for a repeated `POST`/`PUT`/
 * `PATCH`/`DELETE` carrying the same `Idempotency-Key` header, and rejects a
 * changed body on the same key with 409.
 *
 * Only mutating methods honour the header; GET/HEAD pass through untouched.
 */
function hashBody(body: unknown): string {
  try {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(body ?? null))
      .digest('hex');
  } catch {
    return crypto.createHash('sha256').update(String(body)).digest('hex');
  }
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest() as {
      method?: string;
      headers?: Record<string, string | string[] | undefined>;
      url?: string;
      route?: { path?: string };
      body?: unknown;
      companyId?: string;
      principal?: { user?: { id?: string } };
    };
    const response = context.switchToHttp().getResponse<{ status: (code: number) => unknown }>();

    const method = request.method?.toUpperCase();
    if (method === undefined || method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next.handle();
    }

    const key = request.headers?.['idempotency-key'];
    if (typeof key !== 'string' || key.trim() === '') {
      return next.handle();
    }

    const companyId = request.companyId;
    const userId = request.principal?.user?.id;
    if (companyId === undefined || userId === undefined) {
      return next.handle();
    }

    const route = `${method} ${request.route?.path ?? request.url?.split('?')[0] ?? ''}`;
    const cleanKey = key.trim().slice(0, 120);
    const requestHash = hashBody(request.body);

    return from(this.claim(companyId, userId, route, cleanKey, requestHash)).pipe(
      switchMap((claim) => {
        if (!claim.owner) {
          if (claim.mismatch) {
            return throwError(
              () =>
                new ConflictError(
                  'The same Idempotency-Key has already been used with a different request body.',
                ),
            );
          }
          // Replay cached response.
          const statusCode = claim.cachedStatusCode ?? 200;
          response.status(statusCode);
          return of(claim.cachedBody);
        }
        // owner: execute and persist
        return next.handle().pipe(
          tap((value) => {
            void this.persistResponse(
              claim.rowId as string,
              companyId,
              userId,
              route,
              cleanKey,
              value,
            );
          }),
        );
      }),
    );
  }

  private async claim(
    companyId: string,
    userId: string,
    route: string,
    key: string,
    requestHash: string,
  ): Promise<{
    owner: boolean;
    rowId: string | null;
    cachedBody: unknown;
    cachedStatusCode: number | null;
    mismatch: boolean;
  }> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      // Clear expired rows for this tenant occasionally (best-effort).
      await tx.idempotencyKey
        .deleteMany({
          where: { companyId, expiresAt: { lt: new Date() } },
        })
        .catch(() => undefined);

      const existing = await tx.idempotencyKey.findFirst({
        where: { companyId, userId, route, key },
      });

      if (existing !== null) {
        if (existing.requestHash !== requestHash) {
          return {
            owner: false,
            rowId: null,
            cachedBody: null,
            cachedStatusCode: null,
            mismatch: true,
          };
        }
        // Still in progress: refuse with 409? Replay empty (rare). Treat as already-owned? We'll replay cached.
        if (existing.completedAt === null) {
          return {
            owner: false,
            rowId: null,
            cachedBody: null,
            cachedStatusCode: 202,
            mismatch: false,
          };
        }
        // Owner previously completed.
        return {
          owner: false,
          rowId: null,
          cachedBody: existing.responseBody,
          cachedStatusCode: existing.statusCode ?? 200,
          mismatch: false,
        };
      }

      const created = await tx.idempotencyKey.create({
        data: {
          companyId,
          userId,
          route,
          key,
          requestHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return {
        owner: true,
        rowId: created.id,
        cachedBody: null,
        cachedStatusCode: null,
        mismatch: false,
      };
    });
  }

  private async persistResponse(
    rowId: string,
    companyId: string,
    userId: string,
    route: string,
    key: string,
    body: unknown,
  ): Promise<void> {
    const client = this.prisma.getClient();
    try {
      await withTenantContext(client, companyId, async (tx) => {
        await tx.idempotencyKey.updateMany({
          where: { id: rowId },
          data: { statusCode: 200, responseBody: body as object, completedAt: new Date() },
        });
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to persist idempotency response: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
