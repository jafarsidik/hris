import { Inject, Injectable } from '@nestjs/common';

import crypto from 'node:crypto';

import { withTenantContext } from '@hris/database';
import type {
  AccessReviewItemSummary,
  AccessReviewSummary,
  ServiceAccountSummary,
} from '@hris/shared-types';

import { ConflictError, NotFoundError } from '../../common/errors/app-error';
import { LogService } from '../logs/log.service';
import { PrismaService } from '../database/prisma.service';

interface Actor {
  companyId: string;
  userId: string;
}

interface ReviewRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly scope: string;
  readonly reviewerId: string;
  readonly status: string;
  readonly dueAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface ItemRow {
  readonly id: string;
  readonly reviewId: string;
  readonly userId: string;
  readonly resource: string;
  readonly resourceId: string | null;
  readonly permissions: unknown;
  readonly decision: string;
  readonly decidedAt: Date | null;
  readonly notes: string | null;
  readonly user: { readonly email: string; readonly displayName: string };
}

interface AccountRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly key: string;
  readonly secretHash: string;
  readonly isActive: boolean;
  readonly expiresAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toReviewSummary(
  row: ReviewRow,
  itemCount: number,
  decidedCount: number,
): AccessReviewSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    scope: row.scope,
    reviewerId: row.reviewerId,
    status: row.status,
    dueAt: row.dueAt === null ? null : row.dueAt.toISOString(),
    completedAt: row.completedAt === null ? null : row.completedAt.toISOString(),
    itemCount,
    decidedCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toItemSummary(row: ItemRow): AccessReviewItemSummary {
  return {
    id: row.id,
    reviewId: row.reviewId,
    userId: row.userId,
    userEmail: row.user.email,
    userDisplayName: row.user.displayName,
    resource: row.resource,
    resourceId: row.resourceId,
    permissions: Array.isArray(row.permissions) ? (row.permissions as readonly string[]) : [],
    decision: row.decision,
    decidedAt: row.decidedAt === null ? null : row.decidedAt.toISOString(),
    notes: row.notes,
  };
}

function toAccountSummary(row: AccountRow): ServiceAccountSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    key: row.key,
    isActive: row.isActive,
    expiresAt: row.expiresAt === null ? null : row.expiresAt.toISOString(),
    lastUsedAt: row.lastUsedAt === null ? null : row.lastUsedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Access Reviews: periodic certification that a user's permissions are still
 * appropriate. A review holds one item per (user, resource) grant; the reviewer
 * decides each item (approve / revoke / no action). When every item is decided the
 * review is marked completed.
 */
@Injectable()
export class AccessReviewsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  async list(companyId: string): Promise<AccessReviewSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await (
        tx as unknown as {
          accessReview: { findMany: (a: unknown) => Promise<ReviewRow[]> };
        }
      ).accessReview.findMany({ orderBy: { createdAt: 'desc' } });
      const summaries: AccessReviewSummary[] = [];
      for (const row of rows) {
        const items = await (
          tx as unknown as {
            accessReviewItem: { count: (a: unknown) => Promise<number> };
          }
        ).accessReviewItem.count({ where: { reviewId: row.id } });
        const decided = await (
          tx as unknown as {
            accessReviewItem: { count: (a: unknown) => Promise<number> };
          }
        ).accessReviewItem.count({
          where: { reviewId: row.id, decision: { not: 'NO_ACTION' } },
        });
        summaries.push(toReviewSummary(row, items, decided));
      }
      return summaries;
    });
  }

  async get(
    companyId: string,
    id: string,
  ): Promise<AccessReviewSummary & { items: AccessReviewItemSummary[] }> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const review = await (
        tx as unknown as {
          accessReview: { findFirst: (a: unknown) => Promise<ReviewRow | null> };
        }
      ).accessReview.findFirst({ where: { id } });
      if (review === null) {
        throw new NotFoundError('The access review does not exist.');
      }
      const items = await (
        tx as unknown as {
          accessReviewItem: { findMany: (a: unknown) => Promise<ItemRow[]> };
        }
      ).accessReviewItem.findMany({ where: { reviewId: id }, orderBy: { userId: 'asc' } });
      let decided = 0;
      for (const item of items) {
        if (item.decision !== 'NO_ACTION') {
          decided += 1;
        }
      }
      return {
        ...toReviewSummary(review, items.length, decided),
        items: items.map(toItemSummary),
      };
    });
  }

  async create(
    actor: Actor,
    input: { name: string; description: string | null; reviewerId: string; dueAt: string | null },
  ): Promise<AccessReviewSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const row = await (
        tx as unknown as {
          accessReview: { create: (a: unknown) => Promise<ReviewRow> };
        }
      ).accessReview.create({
        data: {
          companyId: actor.companyId,
          name: input.name,
          description: input.description,
          scope: 'company',
          reviewerId: input.reviewerId,
          dueAt: input.dueAt === null ? null : new Date(input.dueAt),
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'access_review.create',
        resource: 'access_review',
        resourceId: row.id,
        payload: { name: input.name },
      });
      return toReviewSummary(row, 0, 0);
    });
  }

  async update(
    actor: Actor,
    id: string,
    input: {
      name?: string;
      description?: string | null;
      reviewerId?: string;
      dueAt?: string | null;
    },
  ): Promise<AccessReviewSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const delegate = (
        tx as unknown as {
          accessReview: {
            findFirst: (a: unknown) => Promise<ReviewRow | null>;
            update: (a: unknown) => Promise<ReviewRow>;
          };
        }
      ).accessReview;
      const existing = await delegate.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The access review does not exist.');
      }
      const row = await delegate.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.reviewerId !== undefined ? { reviewerId: input.reviewerId } : {}),
          ...(input.dueAt !== undefined
            ? { dueAt: input.dueAt === null ? null : new Date(input.dueAt) }
            : {}),
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'access_review.update',
        resource: 'access_review',
        resourceId: id,
        payload: { name: existing.name },
      });
      return toReviewSummary(row, 0, 0);
    });
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, actor.companyId, async (tx) => {
      const delegate = (
        tx as unknown as {
          accessReview: {
            findFirst: (a: unknown) => Promise<ReviewRow | null>;
            delete: (a: unknown) => Promise<unknown>;
          };
        }
      ).accessReview;
      const existing = await delegate.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The access review does not exist.');
      }
      await delegate.delete({ where: { id } });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'access_review.delete',
        resource: 'access_review',
        resourceId: id,
        payload: { name: existing.name },
      });
    });
  }

  async decideItem(
    actor: Actor,
    reviewId: string,
    itemId: string,
    decision: string,
    notes: string | null,
  ): Promise<void> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const delegate = (
        tx as unknown as {
          accessReviewItem: {
            findFirst: (a: unknown) => Promise<ItemRow | null>;
            update: (a: unknown) => Promise<ItemRow>;
          };
        }
      ).accessReviewItem;
      const item = await delegate.findFirst({ where: { id: itemId, reviewId } });
      if (item === null) {
        throw new NotFoundError('The review item does not exist.');
      }
      await delegate.update({
        where: { id: itemId },
        data: { decision, decidedAt: new Date(), notes },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'access_review_item.decide',
        resource: 'access_review_item',
        resourceId: itemId,
        payload: { reviewId, decision },
      });
    });
  }
}

/**
 * Service Accounts: non-human identities for automation, scoped to a single tenant.
 * Distinct from API clients (platform-wide developer credentials) in that they are
 * owned and rotated within a tenant console.
 */
@Injectable()
export class ServiceAccountsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  async list(companyId: string): Promise<ServiceAccountSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await (
        tx as unknown as {
          serviceAccount: { findMany: (a: unknown) => Promise<AccountRow[]> };
        }
      ).serviceAccount.findMany({ orderBy: { name: 'asc' } });
      return rows.map(toAccountSummary);
    });
  }

  async create(
    actor: Actor,
    input: { name: string; description: string | null; key: string; expiresAt: string | null },
  ): Promise<{ summary: ServiceAccountSummary; secret: string }> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const existing = await (
        tx as unknown as {
          serviceAccount: { findFirst: (a: unknown) => Promise<AccountRow | null> };
        }
      ).serviceAccount.findFirst({ where: { key: input.key } });
      if (existing !== null) {
        throw new ConflictError('A service account with that key already exists.');
      }
      const secret = cryptoRandom(32);
      const row = await (
        tx as unknown as {
          serviceAccount: { create: (a: unknown) => Promise<AccountRow> };
        }
      ).serviceAccount.create({
        data: {
          companyId: actor.companyId,
          name: input.name,
          description: input.description,
          key: input.key,
          secretHash: sha256(secret),
          isActive: true,
          expiresAt: input.expiresAt === null ? null : new Date(input.expiresAt),
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'service_account.create',
        resource: 'service_account',
        resourceId: row.id,
        payload: { name: input.name, key: input.key },
      });
      return { summary: toAccountSummary(row), secret };
    });
  }

  async rotateSecret(actor: Actor, id: string): Promise<{ secret: string }> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const delegate = (
        tx as unknown as {
          serviceAccount: {
            findFirst: (a: unknown) => Promise<AccountRow | null>;
            update: (a: unknown) => Promise<AccountRow>;
          };
        }
      ).serviceAccount;
      const existing = await delegate.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The service account does not exist.');
      }
      const secret = cryptoRandom(32);
      await delegate.update({
        where: { id },
        data: { secretHash: sha256(secret) },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'service_account.rotate_secret',
        resource: 'service_account',
        resourceId: id,
        payload: { name: existing.name },
      });
      return { secret };
    });
  }

  async update(
    actor: Actor,
    id: string,
    input: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
      expiresAt?: string | null;
    },
  ): Promise<ServiceAccountSummary> {
    const client = this.prisma.getClient();
    return withTenantContext(client, actor.companyId, async (tx) => {
      const delegate = (
        tx as unknown as {
          serviceAccount: {
            findFirst: (a: unknown) => Promise<AccountRow | null>;
            update: (a: unknown) => Promise<AccountRow>;
          };
        }
      ).serviceAccount;
      const existing = await delegate.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The service account does not exist.');
      }
      const row = await delegate.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.expiresAt !== undefined
            ? { expiresAt: input.expiresAt === null ? null : new Date(input.expiresAt) }
            : {}),
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'service_account.update',
        resource: 'service_account',
        resourceId: id,
        payload: { name: existing.name },
      });
      return toAccountSummary(row);
    });
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const client = this.prisma.getClient();
    await withTenantContext(client, actor.companyId, async (tx) => {
      const delegate = (
        tx as unknown as {
          serviceAccount: {
            findFirst: (a: unknown) => Promise<AccountRow | null>;
            delete: (a: unknown) => Promise<unknown>;
          };
        }
      ).serviceAccount;
      const existing = await delegate.findFirst({ where: { id } });
      if (existing === null) {
        throw new NotFoundError('The service account does not exist.');
      }
      await delegate.delete({ where: { id } });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'service_account.delete',
        resource: 'service_account',
        resourceId: id,
        payload: { name: existing.name },
      });
    });
  }
}

function cryptoRandom(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
