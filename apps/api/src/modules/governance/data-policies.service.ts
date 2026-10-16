import { Inject, Injectable } from '@nestjs/common';

import { withTenantContext } from '@hris/database';
import type { DataPolicySummary } from '@hris/shared-types';

import { NotFoundError } from '../../common/errors/app-error';
import { LogService } from '../logs/log.service';
import { PrismaService } from '../database/prisma.service';

interface Actor {
  companyId: string;
  userId: string;
}

@Injectable()
export class DataPoliciesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  async list(companyId: string): Promise<DataPolicySummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await (
        tx as unknown as {
          dataPolicy: { findMany: (args: unknown) => Promise<Array<Record<string, unknown>>> };
        }
      ).dataPolicy.findMany({
        orderBy: { name: 'asc' },
      });
      return rows.map((row) => this.toSummary(row));
    });
  }

  async create(
    actor: Actor,
    input: {
      name: string;
      description: string | null;
      classification: string;
      targetResource: string;
      maskingAction: string;
      isEnabled: boolean;
    },
  ): Promise<DataPolicySummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const row = await (
        tx as unknown as {
          dataPolicy: { create: (args: unknown) => Promise<Record<string, unknown>> };
        }
      ).dataPolicy.create({
        data: {
          companyId: actor.companyId,
          name: input.name.trim(),
          description: input.description,
          classification: input.classification,
          targetResource: input.targetResource,
          maskingAction: input.maskingAction,
          isEnabled: input.isEnabled,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'data_policy.create',
        resource: 'data_policy',
        resourceId: String(row.id),
        payload: { name: input.name, classification: input.classification },
      });
      return this.toSummary(row);
    });
  }

  async update(
    actor: Actor,
    id: string,
    input: Partial<{
      name: string;
      description: string | null;
      classification: string;
      targetResource: string;
      maskingAction: string;
      isEnabled: boolean;
    }>,
  ): Promise<DataPolicySummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const delegate = (
        tx as unknown as {
          dataPolicy: {
            findFirst: (a: unknown) => Promise<Record<string, unknown> | null>;
            update: (a: unknown) => Promise<Record<string, unknown>>;
          };
        }
      ).dataPolicy;
      const existing = await delegate.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The data policy does not exist.');
      }
      const row = await delegate.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.classification !== undefined ? { classification: input.classification } : {}),
          ...(input.targetResource !== undefined ? { targetResource: input.targetResource } : {}),
          ...(input.maskingAction !== undefined ? { maskingAction: input.maskingAction } : {}),
          ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'data_policy.update',
        resource: 'data_policy',
        resourceId: id,
        payload: { name: String(existing.name) },
      });
      return this.toSummary(row);
    });
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, actor.companyId, async (tx) => {
      const delegate = (
        tx as unknown as {
          dataPolicy: {
            findFirst: (a: unknown) => Promise<Record<string, unknown> | null>;
            delete: (a: unknown) => Promise<unknown>;
          };
        }
      ).dataPolicy;
      const existing = await delegate.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The data policy does not exist.');
      }
      await delegate.delete({ where: { id } });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'data_policy.delete',
        resource: 'data_policy',
        resourceId: id,
        payload: { name: String(existing.name) },
      });
    });
  }

  private toSummary(row: Record<string, unknown>): DataPolicySummary {
    return {
      id: String(row.id),
      name: String(row.name),
      description:
        row.description === null || row.description === undefined ? null : String(row.description),
      classification: String(row.classification),
      targetResource: String(row.targetResource ?? row.target_resource),
      maskingAction: String(row.maskingAction ?? row.masking_action),
      isEnabled: Boolean(row.isEnabled ?? row.is_enabled),
      createdAt: new Date(String(row.createdAt ?? row.created_at)).toISOString(),
      updatedAt: new Date(String(row.updatedAt ?? row.updated_at)).toISOString(),
    };
  }
}
