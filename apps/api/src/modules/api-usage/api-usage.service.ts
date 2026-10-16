import { Inject, Injectable } from '@nestjs/common';

import type { Prisma } from '@hris/database';
import { withTenantContext } from '@hris/database';
import {
  buildPage,
  cursorFingerprint,
  resolveCursor,
  type PageParams,
  type Paginated,
} from '@hris/shared-types';

import { ValidationError } from '../../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

/** A request to record, assembled by the request-usage middleware. */
export interface ApiRequestRecord {
  readonly companyId: string;
  readonly apiClientId: string;
  readonly method: string;
  readonly path: string;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly correlationId?: string;
}

/** Per-client rollup over a time window. */
export interface ApiUsageRow {
  readonly clientId: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly requestCount: number;
  readonly errorCount: number;
  readonly avgDurationMs: number | null;
}

export interface ApiUsageReport {
  readonly items: readonly ApiUsageRow[];
  readonly from: string | null;
  readonly to: string | null;
  readonly totalRequests: number;
  readonly totalErrors: number;
}

/** One recorded request, as the access-log surface reads it. */
export interface ApiRequestLogEntry {
  readonly id: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly method: string;
  readonly path: string;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly correlationId: string | null;
  readonly occurredAt: string;
}

export interface ApiUsageFilter {
  readonly from?: string;
  readonly to?: string;
  readonly clientId?: string;
}

const REQUEST_SELECT = {
  id: true,
  apiClientId: true,
  method: true,
  path: true,
  statusCode: true,
  durationMs: true,
  correlationId: true,
  occurredAt: true,
  apiClient: { select: { name: true } },
} as const;

type ApiRequestLogRow = Prisma.ApiRequestLogGetPayload<{ select: typeof REQUEST_SELECT }>;

const REQUEST_SORT = { occurredAt: 'desc', id: 'desc' } as const;

/** Keyset predicate for the (occurred_at DESC, id DESC) ordering. */
function afterCursor(values: readonly string[]): Prisma.ApiRequestLogWhereInput {
  const occurredAt = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return {
    OR: [{ occurredAt: { lt: occurredAt } }, { occurredAt, id: { lt: id } }],
  };
}

/** Folds an optional ISO window into a Prisma `occurredAt` filter. */
function windowFilter(filter: ApiUsageFilter): Prisma.ApiRequestLogWhereInput {
  const occurredAt: Prisma.DateTimeFilter = {};
  if (filter.from !== undefined) {
    occurredAt.gte = new Date(filter.from);
  }
  if (filter.to !== undefined) {
    occurredAt.lte = new Date(filter.to);
  }
  return {
    ...(filter.clientId === undefined ? {} : { apiClientId: filter.clientId }),
    ...(Object.keys(occurredAt).length === 0 ? {} : { occurredAt }),
  };
}

/**
 * Developer API request usage.
 *
 * Every request made with an API key is recorded as one append-only row by the
 * middleware; this service writes those rows and answers the two read shapes built on
 * them — a per-client rollup over a window and a paginated request log. Aggregates are
 * computed on read rather than stored, so a row is the only thing that can be wrong.
 */
@Injectable()
export class ApiUsageService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Records one machine request. Never throws into the request's error path. */
  async record(input: ApiRequestRecord): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, input.companyId, (tx) =>
      tx.apiRequestLog.create({
        data: {
          companyId: input.companyId,
          apiClientId: input.apiClientId,
          method: input.method,
          path: input.path,
          statusCode: input.statusCode,
          durationMs: input.durationMs,
          ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
        },
      }),
    );
  }

  /**
   * Per-client request volume and error rate over the window.
   *
   * Every live client is listed, including one with no requests in the window, so a
   * client that stopped calling is visible as a zero rather than by its absence. Counts
   * come from two grouped queries (all, and errors) joined onto the client list, so the
   * cost does not grow with the number of rows.
   */
  async usage(companyId: string, filter: ApiUsageFilter): Promise<ApiUsageReport> {
    const client = this.prisma.getClient();
    const where = windowFilter(filter);

    return withTenantContext(client, companyId, async (tx) => {
      const clients = await tx.apiClient.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, name: true, isActive: true },
      });

      const totals = await tx.apiRequestLog.groupBy({
        by: ['apiClientId'],
        where,
        orderBy: { apiClientId: 'asc' },
        _count: { _all: true },
        _avg: { durationMs: true },
      });
      const errors = await tx.apiRequestLog.groupBy({
        by: ['apiClientId'],
        where: { ...where, statusCode: { gte: 400 } },
        orderBy: { apiClientId: 'asc' },
        _count: { _all: true },
      });

      const totalsByClient = new Map(totals.map((row) => [row.apiClientId, row]));
      const errorsByClient = new Map(errors.map((row) => [row.apiClientId, row._count._all]));

      const items: ApiUsageRow[] = clients.map((entry) => {
        const total = totalsByClient.get(entry.id);
        return {
          clientId: entry.id,
          name: entry.name,
          isActive: entry.isActive,
          requestCount: total?._count._all ?? 0,
          errorCount: errorsByClient.get(entry.id) ?? 0,
          avgDurationMs:
            total?._avg.durationMs === null || total?._avg.durationMs === undefined
              ? null
              : Math.round(total._avg.durationMs),
        };
      });

      const totalRequests = items.reduce((sum, row) => sum + row.requestCount, 0);
      const totalErrors = items.reduce((sum, row) => sum + row.errorCount, 0);

      return {
        items,
        from: filter.from ?? null,
        to: filter.to ?? null,
        totalRequests,
        totalErrors,
      };
    });
  }

  /** A page of recorded requests, newest first, optionally scoped to one client. */
  async requests(
    companyId: string,
    filter: ApiUsageFilter,
    params: PageParams,
  ): Promise<Paginated<ApiRequestLogEntry>> {
    const client = this.prisma.getClient();
    const where = windowFilter(filter);
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: REQUEST_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows: ApiRequestLogRow[] = await withTenantContext(client, companyId, (tx) =>
      tx.apiRequestLog.findMany({
        where: {
          companyId,
          ...where,
          ...(resolved.cursor.position.values.length > 0
            ? afterCursor(resolved.cursor.position.values)
            : {}),
        },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: params.limit + 1,
        select: REQUEST_SELECT,
      }),
    );

    const items = rows.map(toEntry);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.occurredAt, item.id],
    }));
  }
}

function toEntry(row: ApiRequestLogRow): ApiRequestLogEntry {
  return {
    id: row.id,
    clientId: row.apiClientId,
    clientName: row.apiClient.name,
    method: row.method,
    path: row.path,
    statusCode: row.statusCode,
    durationMs: row.durationMs,
    correlationId: row.correlationId,
    occurredAt: row.occurredAt.toISOString(),
  };
}
