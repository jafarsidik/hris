import { Inject, Injectable } from '@nestjs/common';

import { withTenantContext } from '@hris/database';
import type { FeatureFlagSummary, TenantFeatureFlagDecision } from '@hris/shared-types';

import { NotFoundError } from '../../common/errors/app-error';
import { LogService } from '../logs/log.service';
import { PrismaService } from '../database/prisma.service';

export interface FeatureFlagInput {
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly enabled: boolean;
  readonly rollout: Record<string, unknown>;
}

@Injectable()
export class FeatureFlagsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  /** Flags effective for a tenant: own rows only (no global concept in v1). */
  async resolve(companyId: string): Promise<TenantFeatureFlagDecision[]> {
    const rows = await this.list(companyId);
    return rows.map((flag) => ({ key: flag.key, enabled: flag.enabled }));
  }

  async list(companyId: string): Promise<FeatureFlagSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await tx.featureFlag.findMany({ orderBy: { key: 'asc' } });
      return rows.map((row) => ({
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        scope: 'tenant' as const,
        enabled: row.enabled,
        rollout:
          typeof row.rollout === 'object' && row.rollout !== null && !Array.isArray(row.rollout)
            ? (row.rollout as Record<string, unknown>)
            : {},
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    });
  }

  async create(
    actor: { companyId: string; userId: string },
    input: FeatureFlagInput,
  ): Promise<FeatureFlagSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const row = await tx.featureFlag.create({
        data: {
          companyId: actor.companyId,
          key: input.key,
          name: input.name,
          description: input.description,
          enabled: input.enabled,
          rollout: input.rollout as object,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'feature_flag.create',
        resource: 'feature_flag',
        resourceId: row.id,
        payload: { key: input.key },
      });
      return {
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        scope: 'tenant',
        enabled: row.enabled,
        rollout:
          typeof row.rollout === 'object' && row.rollout !== null
            ? (row.rollout as Record<string, unknown>)
            : {},
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  async update(
    actor: { companyId: string; userId: string },
    id: string,
    input: Partial<FeatureFlagInput>,
  ): Promise<FeatureFlagSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await tx.featureFlag.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The feature flag does not exist.');
      }
      const row = await tx.featureFlag.update({
        where: { id },
        data: {
          ...(input.key !== undefined ? { key: input.key } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.rollout !== undefined ? { rollout: input.rollout as object } : {}),
        },
      });
      return {
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        scope: 'tenant',
        enabled: row.enabled,
        rollout:
          typeof row.rollout === 'object' && row.rollout !== null
            ? (row.rollout as Record<string, unknown>)
            : {},
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  async remove(actor: { companyId: string; userId: string }, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await tx.featureFlag.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The feature flag does not exist.');
      }
      await tx.featureFlag.delete({ where: { id } });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'feature_flag.delete',
        resource: 'feature_flag',
        resourceId: id,
        payload: { key: existing.key },
      });
    });
  }

  async toggle(
    actor: { companyId: string; userId: string },
    id: string,
    enabled: boolean,
  ): Promise<FeatureFlagSummary> {
    return this.update(actor, id, { enabled });
  }
}
