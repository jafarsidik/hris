import { Inject, Injectable } from '@nestjs/common';

import { withTenantContext } from '@hris/database';
import {
  APPROVAL_SUBJECT_TYPES,
  LOG_EVENT_TYPES,
  type ApprovalAuthoritySummary,
  type ApprovalDelegationSummary,
  type ApprovalSubjectType,
} from '@hris/shared-types';

import { NotFoundError, UnprocessableEntityError } from '../../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';

/** Admin input for an approval authority rule. */
export interface AuthorityInput {
  readonly subjectType: ApprovalSubjectType;
  readonly subjectId: string;
  readonly resource?: string | null;
  readonly category?: string | null;
  readonly maxAmount?: string | null;
  readonly currencyCode?: string | null;
  readonly effectiveFrom?: string | null;
  readonly effectiveTo?: string | null;
}

export type AuthorityUpdateInput = Partial<AuthorityInput>;

/** Admin input for a temporary approval delegation. */
export interface DelegationInput {
  readonly delegatorUserId: string;
  readonly delegateeUserId: string;
  readonly resource?: string | null;
  readonly category?: string | null;
  readonly effectiveFrom?: string | null;
  readonly effectiveTo?: string | null;
  readonly reason?: string | null;
}

const MONEY_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;

/**
 * Approval authority (System -> Access Management).
 *
 * This module owns the configuration and validation of who may approve what: the
 * rules and delegations are stored, validated and audited here. Enforcement — routing
 * a real approval through these rules — belongs to the M07 workflow engine, which is
 * not part of the System menu, so it is intentionally out of scope for now.
 */
@Injectable()
export class ApprovalService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  // ---------------------------------------------------------------------------
  // Authority rules
  // ---------------------------------------------------------------------------

  async listAuthorities(companyId: string): Promise<ApprovalAuthoritySummary[]> {
    const client = this.prisma.getClient();
    const rows = await withTenantContext(client, companyId, (tx) =>
      tx.approvalAuthority.findMany({ orderBy: { createdAt: 'desc' } }),
    );
    return rows.map((row) => this.toAuthoritySummary(row));
  }

  async createAuthority(
    companyId: string,
    actorUserId: string,
    input: AuthorityInput,
  ): Promise<ApprovalAuthoritySummary> {
    this.assertAuthorityInput(input);
    await this.assertSubjectExists(companyId, input.subjectType, input.subjectId);
    const client = this.prisma.getClient();
    const created = await withTenantContext(client, companyId, (tx) =>
      tx.approvalAuthority.create({
        data: {
          companyId,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          resource: input.resource ?? null,
          category: input.category ?? null,
          maxAmount: input.maxAmount ?? null,
          currencyCode: input.currencyCode ?? null,
          effectiveFrom: this.toDate(input.effectiveFrom),
          effectiveTo: this.toDate(input.effectiveTo),
          createdBy: actorUserId,
        },
      }),
    );

    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['approval.authority_created'],
      actorUserId,
      resource: 'approval-authority',
      resourceId: created.id,
      status: 'SUCCESS',
    });
    return this.toAuthoritySummary(created);
  }

  async updateAuthority(
    companyId: string,
    actorUserId: string,
    authorityId: string,
    input: AuthorityUpdateInput,
  ): Promise<ApprovalAuthoritySummary> {
    const existing = await this.findAuthority(companyId, authorityId);
    const subjectType = input.subjectType ?? existing.subjectType;
    const subjectId = input.subjectId ?? existing.subjectId;
    this.assertAuthorityInput({
      subjectType,
      subjectId,
      resource: input.resource,
      category: input.category,
      maxAmount:
        input.maxAmount === undefined
          ? existing.maxAmount === null
            ? null
            : String(existing.maxAmount)
          : input.maxAmount,
      currencyCode: input.currencyCode === undefined ? existing.currencyCode : input.currencyCode,
      effectiveFrom:
        input.effectiveFrom === undefined
          ? (existing.effectiveFrom?.toISOString() ?? null)
          : input.effectiveFrom,
      effectiveTo:
        input.effectiveTo === undefined
          ? (existing.effectiveTo?.toISOString() ?? null)
          : input.effectiveTo,
    });
    if (input.subjectType !== undefined || input.subjectId !== undefined) {
      await this.assertSubjectExists(companyId, subjectType, subjectId);
    }

    const client = this.prisma.getClient();
    const data = this.authorityUpdateData(input);
    const updated = await withTenantContext(client, companyId, (tx) =>
      tx.approvalAuthority.update({ where: { id: existing.id }, data }),
    );

    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['approval.authority_updated'],
      actorUserId,
      resource: 'approval-authority',
      resourceId: existing.id,
      status: 'SUCCESS',
    });
    return this.toAuthoritySummary(updated);
  }

  async removeAuthority(companyId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.findAuthority(companyId, id);
    const client = this.prisma.getClient();
    await withTenantContext(client, companyId, (tx) =>
      tx.approvalAuthority.delete({ where: { id: existing.id } }),
    );
    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['approval.authority_deleted'],
      actorUserId,
      resource: 'approval-authority',
      resourceId: existing.id,
      status: 'SUCCESS',
    });
  }

  // ---------------------------------------------------------------------------
  // Delegations
  // ---------------------------------------------------------------------------

  async listDelegations(companyId: string): Promise<ApprovalDelegationSummary[]> {
    const client = this.prisma.getClient();
    const rows = await withTenantContext(client, companyId, (tx) =>
      tx.approvalDelegation.findMany({ orderBy: { createdAt: 'desc' } }),
    );
    return rows.map((row) => this.toDelegationSummary(row));
  }

  async createDelegation(
    companyId: string,
    actorUserId: string,
    input: DelegationInput,
  ): Promise<ApprovalDelegationSummary> {
    if (input.delegatorUserId === input.delegateeUserId) {
      throw new UnprocessableEntityError('A delegation must be to a different user.');
    }
    this.assertDateRange(input.effectiveFrom, input.effectiveTo);
    await this.assertUserExists(companyId, input.delegatorUserId);
    await this.assertUserExists(companyId, input.delegateeUserId);

    const client = this.prisma.getClient();
    const created = await withTenantContext(client, companyId, (tx) =>
      tx.approvalDelegation.create({
        data: {
          companyId,
          delegatorUserId: input.delegatorUserId,
          delegateeUserId: input.delegateeUserId,
          resource: input.resource ?? null,
          category: input.category ?? null,
          effectiveFrom: this.toDate(input.effectiveFrom),
          effectiveTo: this.toDate(input.effectiveTo),
          reason: input.reason ?? null,
          createdBy: actorUserId,
        },
      }),
    );

    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['approval.delegation_created'],
      actorUserId,
      resource: 'approval-authority',
      resourceId: created.id,
      status: 'SUCCESS',
    });
    return this.toDelegationSummary(created);
  }

  async removeDelegation(companyId: string, actorUserId: string, id: string): Promise<void> {
    const client = this.prisma.getClient();
    const existing = await withTenantContext(client, companyId, (tx) =>
      tx.approvalDelegation.findFirst({ where: { id }, select: { id: true } }),
    );
    if (!existing) {
      throw new NotFoundError('Delegation not found.');
    }
    await withTenantContext(client, companyId, (tx) =>
      tx.approvalDelegation.delete({ where: { id: existing.id } }),
    );
    await this.logs.recordEvent(companyId, {
      category: 'SECURITY',
      eventType: LOG_EVENT_TYPES['approval.delegation_deleted'],
      actorUserId,
      resource: 'approval-authority',
      resourceId: existing.id,
      status: 'SUCCESS',
    });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private assertAuthorityInput(input: AuthorityInput): void {
    if (!(APPROVAL_SUBJECT_TYPES as readonly string[]).includes(input.subjectType)) {
      throw new UnprocessableEntityError('The approval subject type is not supported.');
    }
    const amount = input.maxAmount ?? null;
    const currency = input.currencyCode ?? null;
    if (amount !== null) {
      if (!MONEY_PATTERN.test(amount) || Number(amount) <= 0) {
        throw new UnprocessableEntityError(
          'The approval limit must be a positive amount with at most two decimals.',
        );
      }
      if (currency === null) {
        throw new UnprocessableEntityError('An approval limit requires a currency code.');
      }
    }
    if (currency !== null && !/^[A-Za-z]{3}$/.test(currency)) {
      throw new UnprocessableEntityError('The currency code must be three letters.');
    }
    this.assertDateRange(input.effectiveFrom, input.effectiveTo);
  }

  private assertDateRange(from?: string | null, to?: string | null): void {
    if (from && to && new Date(from).getTime() >= new Date(to).getTime()) {
      throw new UnprocessableEntityError(
        'The effective-from date must be before the effective-to date.',
      );
    }
  }

  private async assertSubjectExists(
    companyId: string,
    subjectType: ApprovalSubjectType,
    subjectId: string,
  ): Promise<void> {
    const client = this.prisma.getClient();
    const exists = await withTenantContext(client, companyId, async (tx) => {
      if (subjectType === 'USER') {
        return (
          (await tx.user.findFirst({ where: { id: subjectId }, select: { id: true } })) !== null
        );
      }
      return (await tx.role.findFirst({ where: { id: subjectId }, select: { id: true } })) !== null;
    });
    if (!exists) {
      throw new UnprocessableEntityError(
        `The selected ${subjectType.toLowerCase()} does not exist.`,
      );
    }
  }

  private async assertUserExists(companyId: string, userId: string): Promise<void> {
    const client = this.prisma.getClient();
    const exists = await withTenantContext(client, companyId, (tx) =>
      tx.user.findFirst({ where: { id: userId }, select: { id: true } }),
    );
    if (!exists) {
      throw new UnprocessableEntityError('The selected user does not exist.');
    }
  }

  private async findAuthority(companyId: string, id: string) {
    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, (tx) =>
      tx.approvalAuthority.findFirst({ where: { id } }),
    );
    if (!row) {
      throw new NotFoundError('Approval authority not found.');
    }
    return row;
  }

  private authorityUpdateData(input: AuthorityUpdateInput): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    if (input.subjectType !== undefined) {
      data['subjectType'] = input.subjectType;
    }
    if (input.subjectId !== undefined) {
      data['subjectId'] = input.subjectId;
    }
    if (input.resource !== undefined) {
      data['resource'] = input.resource;
    }
    if (input.category !== undefined) {
      data['category'] = input.category;
    }
    if (input.maxAmount !== undefined) {
      data['maxAmount'] = input.maxAmount;
    }
    if (input.currencyCode !== undefined) {
      data['currencyCode'] = input.currencyCode;
    }
    if (input.effectiveFrom !== undefined) {
      data['effectiveFrom'] = this.toDate(input.effectiveFrom);
    }
    if (input.effectiveTo !== undefined) {
      data['effectiveTo'] = this.toDate(input.effectiveTo);
    }
    return data;
  }

  private toDate(value?: string | null): Date | null {
    return value ? new Date(value) : null;
  }

  private toAuthoritySummary(row: {
    id: string;
    subjectType: ApprovalSubjectType;
    subjectId: string;
    resource: string | null;
    category: string | null;
    maxAmount: unknown;
    currencyCode: string | null;
    effectiveFrom: Date | null;
    effectiveTo: Date | null;
    createdAt: Date;
  }): ApprovalAuthoritySummary {
    return {
      id: row.id,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      resource: row.resource,
      category: row.category,
      maxAmount: row.maxAmount === null ? null : String(row.maxAmount),
      currencyCode: row.currencyCode,
      effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      effectiveTo: row.effectiveTo?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toDelegationSummary(row: {
    id: string;
    delegatorUserId: string;
    delegateeUserId: string;
    resource: string | null;
    category: string | null;
    effectiveFrom: Date | null;
    effectiveTo: Date | null;
    reason: string | null;
    createdAt: Date;
  }): ApprovalDelegationSummary {
    return {
      id: row.id,
      delegatorUserId: row.delegatorUserId,
      delegateeUserId: row.delegateeUserId,
      resource: row.resource,
      category: row.category,
      effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      effectiveTo: row.effectiveTo?.toISOString() ?? null,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
