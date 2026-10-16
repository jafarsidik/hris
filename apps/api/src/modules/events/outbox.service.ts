import { Inject, Injectable } from '@nestjs/common';

import { withTenantContext, type Prisma } from '@hris/database';
import type { OutboxEventSummary } from '@hris/shared-types';

import { PrismaService } from '../database/prisma.service';
import type { DomainEvent } from './domain-event.types';

/** A persisted event together with the delivery state the retry path needs. */
export interface OutboxEventRecord {
  readonly id: string;
  readonly event: DomainEvent;
  readonly publishedAt: Date | null;
  readonly attempts: number;
}

export interface OutboxListFilter {
  readonly type?: string;
  readonly resource?: string;
  readonly resourceId?: string;
  /** Restrict to events still owed a successful delivery. */
  readonly pendingOnly?: boolean;
  readonly limit: number;
}

/** The columns the summary mapper reads. Structural so a Prisma row fits directly. */
interface OutboxRow {
  readonly id: string;
  readonly type: string;
  readonly resource: string;
  readonly resourceId: string;
  readonly actorUserId: string | null;
  readonly payload: unknown;
  readonly occurredAt: Date;
  readonly publishedAt: Date | null;
  readonly attempts: number;
  readonly lastError: string | null;
}

function asPayload(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toEvent(row: OutboxRow, companyId: string): DomainEvent {
  return {
    type: row.type,
    companyId,
    actorUserId: row.actorUserId,
    resource: row.resource,
    resourceId: row.resourceId,
    payload: asPayload(row.payload),
    occurredAt: row.occurredAt,
  };
}

function toSummary(row: OutboxRow): OutboxEventSummary {
  return {
    id: row.id,
    type: row.type,
    resource: row.resource,
    resourceId: row.resourceId,
    actorUserId: row.actorUserId,
    payload: asPayload(row.payload),
    occurredAt: row.occurredAt.toISOString(),
    publishedAt: row.publishedAt === null ? null : row.publishedAt.toISOString(),
    attempts: row.attempts,
    lastError: row.lastError,
  };
}

/**
 * The durable side of the domain event bus.
 *
 * Every emitted event is written here before any consumer runs, so the fact outlives
 * the request even when a consumer throws. The row is deliberately not a queue: the bus
 * still fans out in-process, and this table is the record of what was emitted, whether
 * its consumers succeeded, and what a retry should re-send. It lives in the `events`
 * module rather than the bus so the bus can be read as policy and this as persistence.
 */
@Injectable()
export class OutboxService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Persists an emitted event and returns its id. Throws if the write fails. */
  async record(event: DomainEvent): Promise<string> {
    const client = this.prisma.getClient();
    return withTenantContext(client, event.companyId, async (tx) => {
      const row = await tx.outboxEvent.create({
        data: {
          companyId: event.companyId,
          type: event.type,
          resource: event.resource,
          resourceId: event.resourceId,
          actorUserId: event.actorUserId,
          payload: asPayload(event.payload) as Prisma.InputJsonValue,
          occurredAt: event.occurredAt,
        },
        select: { id: true },
      });
      return row.id;
    });
  }

  /** Marks an event delivered once every consumer has run without throwing. */
  async markPublished(id: string, companyId: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, (tx) =>
      tx.outboxEvent.updateMany({
        where: { id },
        data: { publishedAt: new Date(), attempts: { increment: 1 }, lastError: null },
      }),
    );
  }

  /** Records a failed delivery so it stays visible and a retry is offered. */
  async markFailed(id: string, companyId: string, message: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, (tx) =>
      tx.outboxEvent.updateMany({
        where: { id },
        data: { attempts: { increment: 1 }, lastError: message.slice(0, 1000) },
      }),
    );
  }

  /** The most recent events for a tenant, newest first, with an optional filter. */
  async list(companyId: string, filter: OutboxListFilter): Promise<readonly OutboxEventSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await tx.outboxEvent.findMany({
        where: {
          ...(filter.type === undefined ? {} : { type: filter.type }),
          ...(filter.resource === undefined ? {} : { resource: filter.resource }),
          ...(filter.resourceId === undefined ? {} : { resourceId: filter.resourceId }),
          ...(filter.pendingOnly === true ? { publishedAt: null } : {}),
        },
        orderBy: { occurredAt: 'desc' },
        take: filter.limit,
      });
      return rows.map(toSummary);
    });
  }

  /** Counts events still owed a delivery, for the registry header. */
  async countPending(companyId: string): Promise<number> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, (tx) =>
      tx.outboxEvent.count({ where: { publishedAt: null } }),
    );
  }

  /** Loads one event for re-delivery, or `null` when it is not in this tenant. */
  async findForRetry(companyId: string, id: string): Promise<OutboxEventRecord | null> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const row = await tx.outboxEvent.findFirst({ where: { id } });
      if (row === null) {
        return null;
      }
      return {
        id: row.id,
        event: toEvent(row, companyId),
        publishedAt: row.publishedAt,
        attempts: row.attempts,
      };
    });
  }
}
