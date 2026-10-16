import { Inject, Injectable, Logger } from '@nestjs/common';

import { withTenantContext } from '@hris/database';
import type { TenantSummary, TenantUpdateInput } from '@hris/shared-types';

import { NotFoundError } from '../../common/errors/app-error';
import { LogService } from '../logs/log.service';
import { PrismaService } from '../database/prisma.service';

interface RawCompany {
  id: string;
  code: string;
  name: string;
  status: string;
  plan: string;
  suspended_at: Date | null;
  trial_ends_at: Date | null;
  seat_limit: number | null;
  storage_quota_bytes: bigint | null;
  created_at: Date;
}

interface TenantActor {
  companyId: string;
  userId: string;
}

/**
 * Platform control plane for the tenants (companies) on the instance.
 *
 * The tenant list crosses the ordinary RLS boundary, so it is produced by the
 * privileged `platform_visible_companies()` scan rather than a per-tenant query.
 */
@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  async list(): Promise<TenantSummary[]> {
    const client = this.prisma.getClient();
    const rows = (await client.$queryRaw`
      SELECT * FROM platform_visible_companies()
    `) as RawCompany[];

    const out: TenantSummary[] = [];
    for (const row of rows) {
      out.push(await this.summarise(row));
    }
    return out;
  }

  async get(id: string): Promise<TenantSummary> {
    const all = await this.list();
    const found = all.find((tenant) => tenant.id === id);
    if (found === undefined) {
      throw new NotFoundError('The tenant does not exist.');
    }
    return found;
  }

  async update(actor: TenantActor, id: string, input: TenantUpdateInput): Promise<TenantSummary> {
    const all = await this.list();
    const tenant = all.find((row) => row.id === id);
    if (tenant === undefined) {
      throw new NotFoundError('The tenant does not exist.');
    }

    const client = this.prisma.getClient();
    await withTenantContext(client, id, async (tx) => {
      await tx.company.update({
        where: { id },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.plan !== undefined ? { plan: input.plan } : {}),
          ...(input.seatLimit !== undefined ? { seatLimit: input.seatLimit } : {}),
          ...(input.storageQuotaBytes !== undefined
            ? { storageQuotaBytes: input.storageQuotaBytes }
            : {}),
          ...(input.trialEndsAt !== undefined
            ? { trialEndsAt: input.trialEndsAt === null ? null : new Date(input.trialEndsAt) }
            : {}),
          ...(input.suspend !== undefined
            ? {
                status: input.suspend ? 'SUSPENDED' : 'ACTIVE',
                suspendedAt: input.suspend ? new Date() : null,
              }
            : {}),
        },
      });
    });

    await this.logs.writeAudit(id, {
      actorUserId: actor.userId,
      action: 'tenant.update',
      resource: 'tenant',
      resourceId: id,
      payload: input as Record<string, unknown>,
    });

    return this.get(id);
  }

  private async summarise(row: RawCompany): Promise<TenantSummary> {
    const client = this.prisma.getClient();
    const userCount = await withTenantContext(client, row.id, async (tx) => {
      return tx.user.count({ where: { status: 'ACTIVE' } });
    }).catch(() => 0);
    const storageUsed = await withTenantContext(client, row.id, async (tx) => {
      const agg = await tx.fileObject.aggregate({
        where: { status: { not: 'DELETED' } },
        _sum: { size: true },
      });
      return Number(agg._sum.size ?? 0);
    }).catch(() => 0);

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      status: row.status as TenantSummary['status'],
      plan: row.plan as TenantSummary['plan'],
      seatLimit: row.seat_limit,
      storageQuotaBytes: row.storage_quota_bytes === null ? null : Number(row.storage_quota_bytes),
      storageUsedBytes: storageUsed,
      userCount,
      trialEndsAt: row.trial_ends_at === null ? null : row.trial_ends_at.toISOString(),
      suspendedAt: row.suspended_at === null ? null : row.suspended_at.toISOString(),
      createdAt: row.created_at.toISOString(),
    };
  }
}
