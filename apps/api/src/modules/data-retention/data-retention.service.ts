import { Inject, Injectable } from '@nestjs/common';

import { withTenantContext } from '@hris/database';
import type { DataRetentionScheduleInput, DataRetentionScheduleSummary } from '@hris/shared-types';

import { ConflictError, NotFoundError } from '../../common/errors/app-error';
import { LogService } from '../logs/log.service';
import { PrismaService } from '../database/prisma.service';

interface Actor {
  companyId: string;
  userId: string;
}

interface Row {
  readonly id: string;
  readonly resource: string;
  readonly retentionDays: number;
  readonly purgeAfterDays: number;
  readonly isEnabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toSummary(row: Row): DataRetentionScheduleSummary {
  return {
    id: row.id,
    resource: row.resource,
    retentionDays: row.retentionDays,
    purgeAfterDays: row.purgeAfterDays,
    isEnabled: row.isEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Data retention schedules: how long each class of platform data is kept before purge.
 * Tenant-scoped through RLS like every other module table.
 */
@Injectable()
export class DataRetentionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  async list(companyId: string): Promise<DataRetentionScheduleSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await (
        tx as unknown as {
          dataRetentionSchedule: { findMany: (a: unknown) => Promise<Row[]> };
        }
      ).dataRetentionSchedule.findMany({ orderBy: { resource: 'asc' } });
      return rows.map(toSummary);
    });
  }

  async create(
    actor: Actor,
    input: DataRetentionScheduleInput,
  ): Promise<DataRetentionScheduleSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await (
        tx as unknown as {
          dataRetentionSchedule: { findFirst: (a: unknown) => Promise<Row | null> };
        }
      ).dataRetentionSchedule.findFirst({
        where: { resource: input.resource },
      });
      if (existing !== null) {
        throw new ConflictError('A retention schedule already exists for this resource.');
      }
      const row = await (
        tx as unknown as {
          dataRetentionSchedule: { create: (a: unknown) => Promise<Row> };
        }
      ).dataRetentionSchedule.create({
        data: {
          companyId: actor.companyId,
          resource: input.resource,
          retentionDays: input.retentionDays,
          purgeAfterDays: input.purgeAfterDays ?? 30,
          isEnabled: input.isEnabled ?? true,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'data_retention.create',
        resource: 'data_retention',
        resourceId: row.id,
        payload: { resource: input.resource },
      });
      return toSummary(row);
    });
  }

  async update(
    actor: Actor,
    id: string,
    input: Partial<DataRetentionScheduleInput>,
  ): Promise<DataRetentionScheduleSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const delegate = (
        tx as unknown as {
          dataRetentionSchedule: {
            findFirst: (a: unknown) => Promise<Row | null>;
            update: (a: unknown) => Promise<Row>;
          };
        }
      ).dataRetentionSchedule;
      const existing = await delegate.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The retention schedule does not exist.');
      }
      const row = await delegate.update({
        where: { id },
        data: {
          ...(input.resource !== undefined ? { resource: input.resource } : {}),
          ...(input.retentionDays !== undefined ? { retentionDays: input.retentionDays } : {}),
          ...(input.purgeAfterDays !== undefined ? { purgeAfterDays: input.purgeAfterDays } : {}),
          ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'data_retention.update',
        resource: 'data_retention',
        resourceId: id,
        payload: { resource: existing.resource },
      });
      return toSummary(row);
    });
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, actor.companyId, async (tx) => {
      const delegate = (
        tx as unknown as {
          dataRetentionSchedule: {
            findFirst: (a: unknown) => Promise<Row | null>;
            delete: (a: unknown) => Promise<unknown>;
          };
        }
      ).dataRetentionSchedule;
      const existing = await delegate.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The retention schedule does not exist.');
      }
      await delegate.delete({ where: { id } });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'data_retention.delete',
        resource: 'data_retention',
        resourceId: id,
        payload: { resource: existing.resource },
      });
    });
  }

  async toggle(
    actor: Actor,
    id: string,
    isEnabled: boolean,
  ): Promise<DataRetentionScheduleSummary> {
    return this.update(actor, id, { isEnabled });
  }
}
