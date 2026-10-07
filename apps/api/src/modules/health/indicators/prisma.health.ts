import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';

import { PrismaService } from '../../database/prisma.service';

/**
 * PostgreSQL readiness.
 *
 * Written by hand because `@nestjs/terminus` has no Prisma indicator, and the check is
 * only worth writing once: it runs a real query through the real client.
 *
 * The query is `SELECT 1`, not a table read, on purpose. A table read would additionally
 * prove the schema exists, but it would also be governed by row-level security, so with
 * no tenant context set it would return zero rows and look like a healthy empty database.
 * Schema existence is the migration's responsibility, not a liveness concern.
 */
@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  // Injected by explicit token. The dependency is only referenced in a type position,
  // and this project's lint rules rewrite that to `import type`, which is erased at
  // runtime; relying on `emitDecoratorMetadata` would then resolve the parameter to
  // `Function` and Nest would report an unresolvable dependency.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    if (!this.prisma.isConfigured) {
      return this.getStatus(key, false, {
        message: 'PostgreSQL is not configured (POSTGRES_APP_USER/POSTGRES_APP_PASSWORD)',
      });
    }

    try {
      const startedAt = process.hrtime.bigint();
      await this.prisma.getClient().$queryRaw`SELECT 1`;
      const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

      return this.getStatus(key, true, { latencyMs: Math.round(latencyMs * 100) / 100 });
    } catch (error: unknown) {
      return this.getStatus(key, false, { message: describePostgresError(error) });
    }
  }
}

/**
 * Reports the underlying cause without leaking credentials or a full stack trace.
 *
 * The message reaches an unauthenticated endpoint, so it names the failure category
 * rather than echoing the driver's message verbatim, which can contain the connection
 * string and therefore the password.
 */
function describePostgresError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'unknown error';
  }

  const code = (error as { code?: unknown }).code;

  if (code === 'ECONNREFUSED') {
    return 'connection refused (is PostgreSQL running, and is POSTGRES_HOST/POSTGRES_PORT correct?)';
  }

  if (code === '28P01') {
    return 'authentication failed for the application role (run "npm run db:grant -w @hris/database")';
  }

  if (code === '3D000') {
    return 'database does not exist (run the migrations)';
  }

  return error.message;
}
