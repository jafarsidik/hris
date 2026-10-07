import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';

import { createPrismaClient, type DatabaseClient } from '@hris/database';

import { APP_CONFIG } from '../../config/app-configuration.module';
import type { AppConfiguration, DatabaseConfig } from '../../config/app-configuration';

/**
 * Owns the process-wide Prisma client.
 *
 * The client is created on first use rather than in the constructor, so a deployment
 * with no database credentials still starts and answers `/health/live`. Creating it
 * eagerly would turn a missing secret into a crash loop, and a crash loop cannot report
 * *why* it is unhealthy.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  private client: DatabaseClient | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfiguration) {}

  /** False when `POSTGRES_APP_*` is absent, which readiness reports as a failure. */
  get isConfigured(): boolean {
    return this.config.database !== null;
  }

  /**
   * The shared client.
   *
   * Throws when unconfigured. Every caller is either a request handler, in which case
   * the exception filter turns it into a 500, or a health indicator, which checks
   * {@link isConfigured} first.
   */
  getClient(): DatabaseClient {
    if (!this.config.database) {
      throw new Error(
        'PostgreSQL is not configured. Set POSTGRES_APP_USER and POSTGRES_APP_PASSWORD, ' +
          'then run "npm run db:grant -w @hris/database" to provision the application role.',
      );
    }

    this.client ??= createPrismaClient({
      environment: toPostgresEnvironment(this.config.database),
      poolSize: this.config.database.poolSize,
    });

    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
      this.client = null;
    }
  }
}

/**
 * Presents a validated {@link DatabaseConfig} in the `POSTGRES_*` shape the database
 * package reads.
 *
 * The owner fields are populated with the application credentials rather than left
 * blank on purpose. `@hris/database` exposes exactly one variable per role, and filling
 * both with the application role is what guarantees the API cannot connect as a
 * superuser even if the mapping is later changed carelessly.
 */
function toPostgresEnvironment(config: DatabaseConfig) {
  return {
    POSTGRES_HOST: config.host,
    POSTGRES_PORT: String(config.port),
    POSTGRES_DB: config.database,
    POSTGRES_USER: config.user,
    POSTGRES_PASSWORD: config.password,
    POSTGRES_APP_USER: config.user,
    POSTGRES_APP_PASSWORD: config.password,
  };
}
