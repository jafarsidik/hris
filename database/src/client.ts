/**
 * Construction of the Prisma client.
 *
 * Two responsibilities live here, and both exist because the failure they prevent is
 * invisible rather than loud:
 *
 *   1. Connecting as the application role, so row-level security actually applies.
 *   2. Attaching the soft-delete filter, so a query cannot forget it.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import type { Prisma } from './generated/prisma/client';
import { PrismaClient } from './generated/prisma/client';

import type { PostgresEnvironment } from './connection-string';
import {
  buildPostgresUrl,
  readApplicationPostgresSettings,
  redactPostgresUrl,
} from './connection-string';
import { softDeleteExtension } from './soft-delete-extension';

export interface CreatePrismaClientOptions {
  /** Defaults to `process.env`. */
  readonly environment?: PostgresEnvironment | undefined;
  /**
   * Postgres pool size.
   *
   * Small on purpose. Connection count is multiplied by the number of API instances and
   * by any PgBouncer pool later in front of it, so an unbounded default here is how a
   * deployment exhausts the database's connection slots.
   */
  readonly poolSize?: number | undefined;
  /** Prisma log levels. Defaults to warnings only, so query logs cannot leak tenant data. */
  readonly log?: readonly Prisma.LogLevel[] | undefined;
}

export type DatabaseClient = ReturnType<typeof createPrismaClient>;

/**
 * Builds a Prisma client for application use.
 *
 * Prisma 7 expects a driver adapter rather than a `datasource.url`, which is what lets
 * the pool size be configured here instead of being baked into a connection string.
 */
export function createPrismaClient(options: CreatePrismaClientOptions = {}) {
  const environment = options.environment ?? process.env;
  const settings = readApplicationPostgresSettings(environment);

  const adapter = new PrismaPg({
    connectionString: buildPostgresUrl(settings),
    max: options.poolSize ?? 10,
  });

  const base = new PrismaClient({
    adapter,
    log: [...(options.log ?? ['warn', 'error'])],
  });

  return base.$extends(softDeleteExtension());
}

/**
 * Connection details safe to log.
 *
 * Included in the error when the API cannot reach PostgreSQL, because "connection
 * refused" does not distinguish a wrong port from a wrong host from a missing volume,
 * and those three have completely different fixes.
 */
export function describeApplicationConnection(
  environment: PostgresEnvironment = process.env,
): string {
  try {
    const settings = readApplicationPostgresSettings(environment);

    return `${redactPostgresUrl(buildPostgresUrl(settings))} as ${settings.user}`;
  } catch (error: unknown) {
    return error instanceof Error ? error.message : 'unavailable';
  }
}
