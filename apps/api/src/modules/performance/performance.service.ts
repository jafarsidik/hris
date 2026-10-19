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
  type Paginated,
  type PageParams,
  type PerformanceCycleSummary,
  type PerformanceGoalQuery,
  type PerformanceGoalSummary,
  type PerformanceReviewQuery,
  type PerformanceReviewSummary,
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

const CYCLE_SORT = { startDate: 'desc', id: 'desc' } as const;
const GOAL_SORT = { createdAt: 'desc', id: 'desc' } as const;
const REVIEW_SORT = { createdAt: 'desc', id: 'desc' } as const;

export const CYCLE_STATUSES = ['PLANNED', 'ACTIVE', 'REVIEW', 'CLOSED'] as const;

interface CycleRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
}

interface GoalRow {
  readonly id: string;
  readonly cycleId: string;
  readonly employeeId: string;
  readonly title: string;
  readonly description: string | null;
  readonly weight: number;
  readonly progress: number;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
  readonly cycle: { readonly name: string };
  readonly employee: {
    readonly id: string;
    readonly employeeNumber: string;
    readonly user: { readonly displayName: string };
  };
}

interface ReviewRow {
  readonly id: string;
  readonly cycleId: string;
  readonly employeeId: string;
  readonly reviewerUserId: string | null;
  readonly rating: number | null;
  readonly summary: string | null;
  readonly status: string;
  readonly submittedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
  readonly cycle: { readonly name: string };
  readonly employee: {
    readonly id: string;
    readonly employeeNumber: string;
    readonly user: { readonly displayName: string };
  };
}

/**
 * Performance: review cycles, employee goals and manager appraisals.
 *
 * Goals and reviews narrow to the caller's `performance:view` scope through
 * the employee's organizational unit, exactly like attendance records.
 */
@Injectable()
export class PerformanceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  // ---------------------------------------------------------------------------
  // Cycles
  // ---------------------------------------------------------------------------

  async listCycles(
    companyId: string,
    principal: SessionPrincipal,
    params: PageParams,
  ): Promise<Paginated<PerformanceCycleSummary>> {
    this.readScopeOrThrow(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({ filters: { companyId }, sort: CYCLE_SORT });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(
      client,
      companyId,
      async (tx) =>
        tx.performanceCycle.findMany({
          where: { companyId, deletedAt: null },
          orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
          take: params.limit + 1,
        }) as unknown as CycleRow[],
    );

    const items = rows.map(toCycleSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.startDate, item.id],
    }));
  }

  async createCycle(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly code: string;
      readonly name: string;
      readonly startDate: string;
      readonly endDate: string;
    },
  ): Promise<PerformanceCycleSummary> {
    this.assertAllScope(principal);
    if (new Date(input.startDate) > new Date(input.endDate)) {
      throw new ValidationError('The cycle start date must be before the end date.');
    }

    const client = this.prisma.getClient();
    const code = input.code.trim();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const clash = await tx.performanceCycle.findFirst({
        where: { companyId, code, deletedAt: null },
        select: { id: true },
      });
      if (clash !== null) {
        throw new ConflictError(`A cycle with the code "${code}" already exists.`);
      }
      return tx.performanceCycle.create({
        data: {
          companyId,
          code,
          name: input.name.trim(),
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          status: 'PLANNED',
          createdBy: principal.user.id,
        },
      }) as unknown as CycleRow;
    });

    await this.audit(companyId, principal.user.id, 'performance.cycle_created', row.id, { code });
    return toCycleSummary(row);
  }

  /** Advance a cycle: PLANNED → ACTIVE → REVIEW → CLOSED. */
  async advanceCycle(
    companyId: string,
    principal: SessionPrincipal,
    cycleId: string,
  ): Promise<PerformanceCycleSummary> {
    this.assertAllScope(principal);
    const client = this.prisma.getClient();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const current = await tx.performanceCycle.findFirst({
        where: { id: cycleId, companyId, deletedAt: null },
      });
      if (current === null) {
        throw new NotFoundError('The performance cycle does not exist.');
      }
      const nextStatus = nextCycleStatus(current.status);
      if (nextStatus === null) {
        throw new ValidationError(`The cycle status "${current.status}" cannot be advanced.`);
      }
      return tx.performanceCycle.update({
        where: { id: cycleId },
        data: { status: nextStatus },
      }) as unknown as CycleRow;
    });

    await this.audit(companyId, principal.user.id, 'performance.cycle_advanced', cycleId, {
      status: row.status,
    });
    return toCycleSummary(row);
  }

  // ---------------------------------------------------------------------------
  // Goals
  // ---------------------------------------------------------------------------

  async listGoals(
    companyId: string,
    principal: SessionPrincipal,
    filter: PerformanceGoalQuery,
    params: PageParams,
  ): Promise<Paginated<PerformanceGoalSummary>> {
    const decision = this.readScopeOrThrow(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: GOAL_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await employeeScopeWhere(tx, decision, principal.user.id);
      return tx.performanceGoal.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...scopeWhere,
          ...(filter.cycleId ? { cycleId: filter.cycleId } : {}),
          ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.search
            ? {
                OR: [
                  {
                    title: { contains: filter.search, mode: 'insensitive' as const },
                  },
                  {
                    employee: {
                      user: {
                        displayName: { contains: filter.search, mode: 'insensitive' as const },
                      },
                    },
                  },
                ],
              }
            : {}),
          ...(resolved.cursor.position.values.length > 0
            ? afterCursor(resolved.cursor.position.values)
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          cycle: { select: { name: true } },
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { displayName: true } },
            },
          },
        },
        take: params.limit + 1,
      }) as unknown as GoalRow[];
    });

    const items = rows.map(toGoalSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async createGoal(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly cycleId: string;
      readonly employeeId: string;
      readonly title: string;
      readonly description: string | null;
      readonly weight: number;
    },
  ): Promise<PerformanceGoalSummary> {
    const decision = this.readScopeOrThrow(principal);
    if (decision.kind === 'self' && input.employeeId !== principal.user.id) {
      throw new OutOfScopeError('You may only create goals for yourself.');
    }
    if (input.weight < 0 || input.weight > 100) {
      throw new ValidationError('The goal weight must be between 0 and 100.');
    }

    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await employeeScopeWhere(tx, decision, principal.user.id);
      const cycle = await tx.performanceCycle.findFirst({
        where: { id: input.cycleId, companyId, deletedAt: null },
        select: { status: true },
      });
      if (cycle === null) {
        throw new NotFoundError('The performance cycle does not exist.');
      }
      if (cycle.status === 'CLOSED') {
        throw new ConflictError('The performance cycle is closed; goals can no longer be added.');
      }
      const employee = await tx.employee.findFirst({
        where: { id: input.employeeId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (employee === null) {
        throw new NotFoundError('The employee does not exist.');
      }
      return tx.performanceGoal.create({
        data: {
          companyId,
          cycleId: input.cycleId,
          employeeId: input.employeeId,
          title: input.title.trim(),
          description: input.description,
          weight: input.weight,
          status: 'IN_PROGRESS',
          createdBy: principal.user.id,
        },
        include: {
          cycle: { select: { name: true } },
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { displayName: true } },
            },
          },
        },
      }) as unknown as GoalRow;
    });

    await this.audit(companyId, principal.user.id, 'performance.goal_created', row.id, {
      cycleId: input.cycleId,
      employeeId: input.employeeId,
    });
    return toGoalSummary(row);
  }

  /** Update a goal's progress (0–100); close when it reaches 100. */
  async updateGoalProgress(
    companyId: string,
    principal: SessionPrincipal,
    goalId: string,
    progress: number,
  ): Promise<PerformanceGoalSummary> {
    const decision = this.readScopeOrThrow(principal);
    if (progress < 0 || progress > 100) {
      throw new ValidationError('The goal progress must be between 0 and 100.');
    }

    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await employeeScopeWhere(tx, decision, principal.user.id);
      const current = await tx.performanceGoal.findFirst({
        where: { id: goalId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The goal does not exist.');
      }
      return tx.performanceGoal.update({
        where: { id: goalId },
        data: {
          progress,
          ...(progress === 100 ? { status: 'ACHIEVED' } : {}),
        },
        include: {
          cycle: { select: { name: true } },
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { displayName: true } },
            },
          },
        },
      }) as unknown as GoalRow;
    });

    await this.audit(companyId, principal.user.id, 'performance.goal_progress_updated', goalId, {
      progress,
    });
    return toGoalSummary(row);
  }

  // ---------------------------------------------------------------------------
  // Reviews
  // ---------------------------------------------------------------------------

  async listReviews(
    companyId: string,
    principal: SessionPrincipal,
    filter: PerformanceReviewQuery,
    params: PageParams,
  ): Promise<Paginated<PerformanceReviewSummary>> {
    const decision = this.readScopeOrThrow(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: REVIEW_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await employeeScopeWhere(tx, decision, principal.user.id);
      return tx.performanceReview.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...scopeWhere,
          ...(filter.cycleId ? { cycleId: filter.cycleId } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.search
            ? {
                OR: [
                  {
                    employee: {
                      user: {
                        displayName: { contains: filter.search, mode: 'insensitive' as const },
                      },
                    },
                  },
                ],
              }
            : {}),
          ...(resolved.cursor.position.values.length > 0
            ? afterCursor(resolved.cursor.position.values)
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          cycle: { select: { name: true } },
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { displayName: true } },
            },
          },
        },
        take: params.limit + 1,
      }) as unknown as ReviewRow[];
    });

    const items = rows.map(toReviewSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async createReview(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly cycleId: string;
      readonly employeeId: string;
      readonly rating: number | null;
      readonly summary: string | null;
    },
  ): Promise<PerformanceReviewSummary> {
    const decision = this.readScopeOrThrow(principal);
    if (decision.kind !== 'all' && decision.kind !== 'subtree') {
      throw new OutOfScopeError('Reviews can only be created by managers with a team scope.');
    }
    if (input.rating !== null && (input.rating < 1 || input.rating > 5)) {
      throw new ValidationError('The review rating must be between 1 and 5.');
    }

    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await employeeScopeWhere(tx, decision, principal.user.id);
      const cycle = await tx.performanceCycle.findFirst({
        where: { id: input.cycleId, companyId, deletedAt: null },
        select: { status: true },
      });
      if (cycle === null) {
        throw new NotFoundError('The performance cycle does not exist.');
      }
      if (cycle.status !== 'REVIEW') {
        throw new ConflictError('Reviews can only be written while the cycle is in review.');
      }
      const employee = await tx.employee.findFirst({
        where: { id: input.employeeId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (employee === null) {
        throw new NotFoundError('The employee does not exist.');
      }
      const existing = await tx.performanceReview.findFirst({
        where: { cycleId: input.cycleId, employeeId: input.employeeId, deletedAt: null },
        select: { id: true },
      });
      if (existing !== null) {
        throw new ConflictError('A review already exists for this employee in this cycle.');
      }
      return tx.performanceReview.create({
        data: {
          companyId,
          cycleId: input.cycleId,
          employeeId: input.employeeId,
          reviewerUserId: principal.user.id,
          rating: input.rating,
          summary: input.summary,
          status: 'SUBMITTED',
          submittedAt: new Date(),
          createdBy: principal.user.id,
        },
        include: {
          cycle: { select: { name: true } },
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { displayName: true } },
            },
          },
        },
      }) as unknown as ReviewRow;
    });

    await this.audit(companyId, principal.user.id, 'performance.review_created', row.id);
    return toReviewSummary(row);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private readScopeOrThrow(principal: SessionPrincipal): ScopeDecision {
    const decision = resolveScope(principal.permissions, 'performance', 'view', {
      userId: principal.user.id,
      unitId: principal.user.organizationalUnitId,
    });
    if (decision.kind === 'denied') {
      throw new OutOfScopeError(
        `Your "${decision.scope ?? 'unresolved'}" scope for performance.view cannot be resolved.`,
      );
    }
    return decision;
  }

  private assertAllScope(principal: SessionPrincipal): void {
    const decision = this.readScopeOrThrow(principal);
    if (decision.kind !== 'all') {
      throw new OutOfScopeError('Cycle management requires company-wide data scope.');
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
      resource: 'performance',
      resourceId,
      status: 'SUCCESS',
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action,
      resource: 'performance',
      resourceId,
      ...(payload === undefined ? {} : { payload }),
    });
  }
}

function nextCycleStatus(status: string): string | null {
  const index = CYCLE_STATUSES.indexOf(status as (typeof CYCLE_STATUSES)[number]);
  if (index < 0 || index >= CYCLE_STATUSES.length - 1) return null;
  return CYCLE_STATUSES[index + 1] ?? null;
}

async function employeeScopeWhere(
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

function afterCursor(values: readonly string[]): Record<string, unknown> {
  const createdAt = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] };
}

function toCycleSummary(row: CycleRow): PerformanceCycleSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toGoalSummary(row: GoalRow): PerformanceGoalSummary {
  return {
    id: row.id,
    cycleId: row.cycleId,
    cycleName: row.cycle.name,
    employeeId: row.employeeId,
    employeeName: row.employee.user.displayName,
    employeeNumber: row.employee.employeeNumber,
    title: row.title,
    description: row.description,
    weight: row.weight,
    progress: row.progress,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toReviewSummary(row: ReviewRow): PerformanceReviewSummary {
  return {
    id: row.id,
    cycleId: row.cycleId,
    cycleName: row.cycle.name,
    employeeId: row.employeeId,
    employeeName: row.employee.user.displayName,
    employeeNumber: row.employee.employeeNumber,
    reviewerUserId: row.reviewerUserId,
    rating: row.rating,
    summary: row.summary,
    status: row.status,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
