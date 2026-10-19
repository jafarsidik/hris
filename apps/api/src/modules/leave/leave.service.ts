import { Inject, Injectable } from '@nestjs/common';

import {
  type Prisma,
  findOrgUnitEntity,
  findOrgUnitSubtree,
  withTenantContext,
} from '@hris/database';
import {
  buildPage,
  cursorFingerprint,
  resolveCursor,
  type LeavePolicyQuery,
  type LeavePolicySummary,
  type LeaveRequestQuery,
  type LeaveRequestSummary,
  type LeaveTypeQuery,
  type LeaveTypeSummary,
  type PageParams,
  type Paginated,
} from '@hris/shared-types';

import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';
import { resolveScope, type ScopeDecision } from '../../common/auth/data-scope';
import { type SessionPrincipal } from '../../common/auth/permission.service';
import {
  ConflictError,
  NotFoundError,
  OutOfScopeError,
  ValidationError,
} from '../../common/errors/app-error';

const LEAVE_TYPE_SORT = { createdAt: 'desc', id: 'desc' } as const;
const LEAVE_POLICY_SORT = { createdAt: 'asc', id: 'asc' } as const;
const LEAVE_REQUEST_SORT = { createdAt: 'desc', id: 'desc' } as const;

interface LeaveTypeRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly isPaid: boolean;
  readonly defaultDays: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
}

interface LeavePolicyRow {
  readonly id: string;
  readonly leaveTypeId: string;
  readonly annualDays: number;
  readonly carryForward: boolean;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
  readonly leaveType: { readonly id: string; readonly code: string; readonly name: string };
}

interface LeaveRequestRow {
  readonly id: string;
  readonly employeeId: string;
  readonly leaveTypeId: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly days: number;
  readonly reason: string | null;
  readonly status: string;
  readonly approverId: string | null;
  readonly approvedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
  readonly employee: {
    readonly id: string;
    readonly employeeNumber: string;
    readonly user: { readonly displayName: string };
  };
  readonly leaveType: { readonly id: string; readonly name: string };
}

/**
 * Leave domain: leave type catalogue, entitlement policies and leave requests
 * with an approval lifecycle.
 *
 * Every read and mutation runs inside `withTenantContext`. Reads narrow to the
 * caller's `leave:view` data scope (`all`/`self`/`subtree`/`entity`). Leave
 * requests additionally respect the `leave.approve` scope for approving others'
 * requests — a caller without it can only see and act on their own.
 */
@Injectable()
export class LeaveService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  // ---------------------------------------------------------------------------
  // Leave types
  // ---------------------------------------------------------------------------

  async listLeaveTypes(
    companyId: string,
    principal: SessionPrincipal,
    filter: LeaveTypeQuery,
    params: PageParams,
  ): Promise<Paginated<LeaveTypeSummary>> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: LEAVE_TYPE_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await leaveTypeScopeWhere(tx, decision);
      return tx.leaveType.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...scopeWhere,
          ...(filter.search ? { OR: leaveTypeSearchWhere(filter.search) } : {}),
          ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
          ...(resolved.cursor.position.values.length > 0
            ? afterLeaveTypeCursor(resolved.cursor.position.values)
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: params.limit + 1,
      }) as unknown as LeaveTypeRow[];
    });

    const items = rows.map(toLeaveTypeSummary);
    return buildPage(items, params, fingerprint, (item) => ({ values: [item.createdAt, item.id] }));
  }

  async createLeaveType(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly code: string;
      readonly name: string;
      readonly description: string | null;
      readonly isPaid: boolean;
      readonly defaultDays: number;
      readonly isActive: boolean;
    },
  ): Promise<LeaveTypeSummary> {
    const decision = this.readScope(principal);
    if (decision.kind !== 'all') {
      throw new OutOfScopeError('Your scope does not allow creating leave types.');
    }

    const client = this.prisma.getClient();
    const code = input.code.trim();
    const row = await withTenantContext(client, companyId, async (tx) => {
      await this.assertLeaveTypeCodeFree(tx, companyId, code, null);
      return tx.leaveType.create({
        data: {
          companyId,
          code,
          name: input.name.trim(),
          description: input.description,
          isPaid: input.isPaid,
          defaultDays: input.defaultDays,
          isActive: input.isActive,
          createdBy: principal.user.id,
        },
      }) as unknown as LeaveTypeRow;
    });

    await this.audit(companyId, principal.user.id, 'leave.type_created', row.id, {
      code,
      name: row.name,
    });
    return toLeaveTypeSummary(row);
  }

  async updateLeaveType(
    companyId: string,
    principal: SessionPrincipal,
    leaveTypeId: string,
    input: {
      readonly name?: string;
      readonly description?: string | null;
      readonly isPaid?: boolean;
      readonly defaultDays?: number;
      readonly isActive?: boolean;
    },
  ): Promise<LeaveTypeSummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await leaveTypeScopeWhere(tx, decision);
      const current = await tx.leaveType.findFirst({
        where: { id: leaveTypeId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The leave type does not exist.');
      }
      return tx.leaveType.update({
        where: { id: leaveTypeId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.isPaid === undefined ? {} : { isPaid: input.isPaid }),
          ...(input.defaultDays === undefined ? {} : { defaultDays: input.defaultDays }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
      }) as unknown as LeaveTypeRow;
    });

    await this.audit(companyId, principal.user.id, 'leave.type_updated', leaveTypeId);
    return toLeaveTypeSummary(row);
  }

  async deleteLeaveType(
    companyId: string,
    principal: SessionPrincipal,
    leaveTypeId: string,
  ): Promise<void> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();

    await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await leaveTypeScopeWhere(tx, decision);
      const current = await tx.leaveType.findFirst({
        where: { id: leaveTypeId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The leave type does not exist.');
      }
      const requests = await tx.leaveRequest.count({
        where: { leaveTypeId, companyId, deletedAt: null },
      });
      if (requests > 0) {
        throw new ConflictError(
          'Reassign or delete the leave type\u2019s requests before deleting it.',
        );
      }
      await tx.leaveType.update({ where: { id: leaveTypeId }, data: { deletedAt: new Date() } });
    });

    await this.audit(companyId, principal.user.id, 'leave.type_deleted', leaveTypeId);
  }

  // ---------------------------------------------------------------------------
  // Leave policies
  // ---------------------------------------------------------------------------

  async listLeavePolicies(
    companyId: string,
    principal: SessionPrincipal,
    filter: LeavePolicyQuery,
    params: PageParams,
  ): Promise<Paginated<LeavePolicySummary>> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: LEAVE_POLICY_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await leaveTypeScopeWhere(tx, decision);
      return tx.leavePolicy.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...scopeWhere,
          ...(filter.leaveTypeId ? { leaveTypeId: filter.leaveTypeId } : {}),
          ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
          ...(resolved.cursor.position.values.length > 0
            ? afterLeavePolicyCursor(resolved.cursor.position.values)
            : {}),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { leaveType: { select: { id: true, code: true, name: true } } },
        take: params.limit + 1,
      }) as unknown as LeavePolicyRow[];
    });

    const items = rows.map(toLeavePolicySummary);
    return buildPage(items, params, fingerprint, (item) => ({ values: [item.createdAt, item.id] }));
  }

  async createLeavePolicy(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly leaveTypeId: string;
      readonly annualDays: number;
      readonly carryForward: boolean;
      readonly isActive: boolean;
    },
  ): Promise<LeavePolicySummary> {
    const decision = this.readScope(principal);
    if (decision.kind !== 'all') {
      throw new OutOfScopeError('Your scope does not allow creating leave policies.');
    }

    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      await this.assertLeavePolicyFree(tx, companyId, input.leaveTypeId, null);
      return tx.leavePolicy.create({
        data: {
          companyId,
          leaveTypeId: input.leaveTypeId,
          annualDays: input.annualDays,
          carryForward: input.carryForward,
          isActive: input.isActive,
          createdBy: principal.user.id,
        },
        include: { leaveType: { select: { id: true, code: true, name: true } } },
      }) as unknown as LeavePolicyRow;
    });

    await this.audit(companyId, principal.user.id, 'leave.policy_created', row.id, {
      leaveTypeId: input.leaveTypeId,
    });
    return toLeavePolicySummary(row);
  }

  async updateLeavePolicy(
    companyId: string,
    principal: SessionPrincipal,
    leavePolicyId: string,
    input: {
      readonly annualDays?: number;
      readonly carryForward?: boolean;
      readonly isActive?: boolean;
    },
  ): Promise<LeavePolicySummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await leaveTypeScopeWhere(tx, decision);
      const current = await tx.leavePolicy.findFirst({
        where: { id: leavePolicyId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The leave policy does not exist.');
      }
      return tx.leavePolicy.update({
        where: { id: leavePolicyId },
        data: {
          ...(input.annualDays === undefined ? {} : { annualDays: input.annualDays }),
          ...(input.carryForward === undefined ? {} : { carryForward: input.carryForward }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
        include: { leaveType: { select: { id: true, code: true, name: true } } },
      }) as unknown as LeavePolicyRow;
    });

    await this.audit(companyId, principal.user.id, 'leave.policy_updated', leavePolicyId);
    return toLeavePolicySummary(row);
  }

  async deleteLeavePolicy(
    companyId: string,
    principal: SessionPrincipal,
    leavePolicyId: string,
  ): Promise<void> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();

    await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await leaveTypeScopeWhere(tx, decision);
      const current = await tx.leavePolicy.findFirst({
        where: { id: leavePolicyId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The leave policy does not exist.');
      }
      await tx.leavePolicy.update({
        where: { id: leavePolicyId },
        data: { deletedAt: new Date() },
      });
    });

    await this.audit(companyId, principal.user.id, 'leave.policy_deleted', leavePolicyId);
  }

  // ---------------------------------------------------------------------------
  // Leave requests
  // ---------------------------------------------------------------------------

  async listLeaveRequests(
    companyId: string,
    principal: SessionPrincipal,
    filter: LeaveRequestQuery,
    params: PageParams,
  ): Promise<Paginated<LeaveRequestSummary>> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: LEAVE_REQUEST_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await leaveRequestScopeWhere(tx, decision, principal.user.id);
      return tx.leaveRequest.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...scopeWhere,
          ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
          ...(filter.leaveTypeId ? { leaveTypeId: filter.leaveTypeId } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.search ? { OR: leaveRequestSearchWhere(filter.search) } : {}),
          ...(resolved.cursor.position.values.length > 0
            ? afterLeaveRequestCursor(resolved.cursor.position.values)
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          employee: {
            select: { id: true, employeeNumber: true, user: { select: { displayName: true } } },
          },
          leaveType: { select: { id: true, name: true } },
        },
        take: params.limit + 1,
      }) as unknown as LeaveRequestRow[];
    });

    const items = rows.map(toLeaveRequestSummary);
    return buildPage(items, params, fingerprint, (item) => ({ values: [item.createdAt, item.id] }));
  }

  async createLeaveRequest(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly employeeId: string;
      readonly leaveTypeId: string;
      readonly startDate: string;
      readonly endDate: string;
      readonly reason: string | null;
    },
  ): Promise<LeaveRequestSummary> {
    const decision = this.readScope(principal);
    if (decision.kind !== 'all' && decision.kind !== 'self') {
      throw new OutOfScopeError('Your scope does not allow creating leave requests.');
    }
    if (decision.kind === 'self' && input.employeeId !== principal.user.id) {
      throw new OutOfScopeError('You may only create leave requests for yourself.');
    }

    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      if (end <= start) {
        throw new ValidationError('The end date must be after the start date.');
      }
      const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      return tx.leaveRequest.create({
        data: {
          companyId,
          employeeId: input.employeeId,
          leaveTypeId: input.leaveTypeId,
          startDate: start,
          endDate: end,
          days: Math.round(days * 100) / 100,
          reason: input.reason,
          status: 'PENDING',
          createdBy: principal.user.id,
        },
        include: {
          employee: {
            select: { id: true, employeeNumber: true, user: { select: { displayName: true } } },
          },
          leaveType: { select: { id: true, name: true } },
        },
      }) as unknown as LeaveRequestRow;
    });

    await this.audit(companyId, principal.user.id, 'leave.request_created', row.id, {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
    });
    return toLeaveRequestSummary(row);
  }

  async getLeaveRequest(
    companyId: string,
    principal: SessionPrincipal,
    leaveRequestId: string,
  ): Promise<LeaveRequestSummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await leaveRequestScopeWhere(tx, decision, principal.user.id);
      return tx.leaveRequest.findFirst({
        where: { id: leaveRequestId, companyId, deletedAt: null, ...scopeWhere },
        include: {
          employee: {
            select: { id: true, employeeNumber: true, user: { select: { displayName: true } } },
          },
          leaveType: { select: { id: true, name: true } },
        },
      }) as unknown as LeaveRequestRow | null;
    });
    if (row === null) {
      throw new NotFoundError('The leave request does not exist.');
    }
    return toLeaveRequestSummary(row);
  }

  async updateLeaveRequest(
    companyId: string,
    principal: SessionPrincipal,
    leaveRequestId: string,
    input: {
      readonly startDate?: string;
      readonly endDate?: string;
      readonly days?: number;
      readonly reason?: string | null;
      readonly status?: string;
    },
  ): Promise<LeaveRequestSummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await leaveRequestScopeWhere(tx, decision, principal.user.id);
      const current = await tx.leaveRequest.findFirst({
        where: { id: leaveRequestId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true, status: true },
      });
      if (current === null) {
        throw new NotFoundError('The leave request does not exist.');
      }
      if (current.status !== 'PENDING' && input.status === undefined) {
        throw new ConflictError('Only pending leave requests can be edited.');
      }
      return tx.leaveRequest.update({
        where: { id: leaveRequestId },
        data: {
          ...(input.startDate === undefined ? {} : { startDate: new Date(input.startDate) }),
          ...(input.endDate === undefined ? {} : { endDate: new Date(input.endDate) }),
          ...(input.days === undefined ? {} : { days: input.days }),
          ...(input.reason === undefined ? {} : { reason: input.reason }),
          ...(input.status === undefined
            ? {}
            : {
                status: input.status,
                ...(input.status === 'APPROVED' || input.status === 'REJECTED'
                  ? { approverId: principal.user.id, approvedAt: new Date() }
                  : {}),
              }),
        },
        include: {
          employee: {
            select: { id: true, employeeNumber: true, user: { select: { displayName: true } } },
          },
          leaveType: { select: { id: true, name: true } },
        },
      }) as unknown as LeaveRequestRow;
    });

    await this.audit(companyId, principal.user.id, 'leave.request_updated', leaveRequestId);
    return toLeaveRequestSummary(row);
  }

  async deleteLeaveRequest(
    companyId: string,
    principal: SessionPrincipal,
    leaveRequestId: string,
  ): Promise<void> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();

    await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await leaveRequestScopeWhere(tx, decision, principal.user.id);
      const current = await tx.leaveRequest.findFirst({
        where: { id: leaveRequestId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true, status: true },
      });
      if (current === null) {
        throw new NotFoundError('The leave request does not exist.');
      }
      if (current.status !== 'PENDING' && current.status !== 'CANCELLED') {
        throw new ConflictError('Only pending or cancelled leave requests can be deleted.');
      }
      await tx.leaveRequest.update({
        where: { id: leaveRequestId },
        data: { deletedAt: new Date() },
      });
    });

    await this.audit(companyId, principal.user.id, 'leave.request_deleted', leaveRequestId);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private readScope(principal: SessionPrincipal): ScopeDecision {
    const decision = resolveScope(principal.permissions, 'leave', 'view', {
      userId: principal.user.id,
      unitId: principal.user.organizationalUnitId,
    });
    if (decision.kind === 'denied') {
      throw new OutOfScopeError(
        `Your "${decision.scope ?? 'unresolved'}" scope for leave.view cannot be resolved.`,
      );
    }
    return decision;
  }

  private async assertLeaveTypeCodeFree(
    tx: Prisma.TransactionClient,
    companyId: string,
    code: string,
    excludeId: string | null,
  ): Promise<void> {
    const clash = await tx.leaveType.findFirst({
      where: {
        companyId,
        code,
        deletedAt: null,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    if (clash !== null) {
      throw new ConflictError(`A leave type with the code "${code}" already exists.`);
    }
  }

  private async assertLeavePolicyFree(
    tx: Prisma.TransactionClient,
    companyId: string,
    leaveTypeId: string,
    excludeId: string | null,
  ): Promise<void> {
    const clash = await tx.leavePolicy.findFirst({
      where: {
        companyId,
        leaveTypeId,
        deletedAt: null,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    if (clash !== null) {
      throw new ConflictError(`A leave policy for this leave type already exists.`);
    }
  }

  private async audit(
    companyId: string,
    actorUserId: string,
    action: string,
    resourceId: string,
    payload?: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await this.logs.recordEvent(companyId, {
      category: 'ACTIVITY',
      eventType: action,
      actorUserId,
      resource: 'leave',
      resourceId,
      status: 'SUCCESS',
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action,
      resource: 'leave',
      resourceId,
      ...(payload === undefined ? {} : { payload }),
    });
  }
}

async function leaveTypeScopeWhere(
  tx: Prisma.TransactionClient,
  decision: ScopeDecision,
): Promise<Record<string, unknown>> {
  switch (decision.kind) {
    case 'all':
      return {};
    case 'subtree': {
      const unitIds = await findOrgUnitSubtree(tx, decision.rootUnitId);
      return unitIds.length > 0 ? {} : { id: { in: [] } };
    }
    case 'entity': {
      const entityId = await findOrgUnitEntity(tx, decision.rootUnitId);
      return entityId ? {} : { id: { in: [] } };
    }
    default:
      return { id: { in: [] } };
  }
}

async function leaveRequestScopeWhere(
  tx: Prisma.TransactionClient,
  decision: ScopeDecision,
  callerUserId: string,
): Promise<Record<string, unknown>> {
  switch (decision.kind) {
    case 'all':
      return {};
    case 'self':
      return { employee: { userId: callerUserId } };
    case 'subtree': {
      const unitIds = await findOrgUnitSubtree(tx, decision.rootUnitId);
      return unitIds.length > 0
        ? { employee: { unit: { id: { in: unitIds } } } }
        : { employee: { unit: { id: { in: [] } } } };
    }
    case 'entity': {
      const entityId = await findOrgUnitEntity(tx, decision.rootUnitId);
      return entityId
        ? { employee: { unit: { entityId } } }
        : { employee: { unit: { id: { in: [] } } } };
    }
    default:
      return { employee: { unit: { id: { in: [] } } } };
  }
}

function leaveTypeSearchWhere(search: string): Record<string, unknown>[] {
  const q = search.trim();
  if (q.length === 0) return [];
  return [
    { code: { contains: q, mode: 'insensitive' } },
    { name: { contains: q, mode: 'insensitive' } },
  ];
}

function leaveRequestSearchWhere(search: string): Record<string, unknown>[] {
  const q = search.trim();
  if (q.length === 0) return [];
  return [
    { employee: { user: { displayName: { contains: q, mode: 'insensitive' } } } },
    { employee: { employeeNumber: { contains: q, mode: 'insensitive' } } },
    { reason: { contains: q, mode: 'insensitive' } },
  ];
}

function afterLeaveTypeCursor(values: readonly string[]): Record<string, unknown> {
  const createdAt = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] };
}

function afterLeavePolicyCursor(values: readonly string[]): Record<string, unknown> {
  const createdAt = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] };
}

function afterLeaveRequestCursor(values: readonly string[]): Record<string, unknown> {
  const createdAt = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] };
}

function toLeaveTypeSummary(row: LeaveTypeRow): LeaveTypeSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isPaid: row.isPaid,
    defaultDays: row.defaultDays,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toLeavePolicySummary(row: LeavePolicyRow): LeavePolicySummary {
  return {
    id: row.id,
    leaveTypeId: row.leaveTypeId,
    leaveTypeName: row.leaveType.name,
    annualDays: row.annualDays,
    carryForward: row.carryForward,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toLeaveRequestSummary(row: LeaveRequestRow): LeaveRequestSummary {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.user.displayName,
    employeeNumber: row.employee.employeeNumber,
    leaveTypeId: row.leaveTypeId,
    leaveTypeName: row.leaveType.name,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    days: row.days,
    reason: row.reason,
    status: row.status,
    approverId: row.approverId,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
