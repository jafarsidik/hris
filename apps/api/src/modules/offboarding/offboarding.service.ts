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
  type OffboardingCaseQuery,
  type OffboardingCaseSummary,
  type Paginated,
  type PageParams,
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

const CASE_SORT = { createdAt: 'desc', id: 'desc' } as const;

export const CASE_STATUSES = ['INITIATED', 'IN_CLEARANCE', 'CLEARED', 'COMPLETED'] as const;

/** The default clearance checklist seeded when a case is created. */
const DEFAULT_CHECKLIST = [
  'Return company assets (laptop, access card)',
  'Clear pending expense claims',
  'Knowledge transfer to successor',
  'Revoke system access and credentials',
  'Exit interview',
] as const;

interface CaseRow {
  readonly id: string;
  readonly employeeId: string;
  readonly reason: string;
  readonly lastWorkingDate: Date;
  readonly status: string;
  readonly exitInterviewNotes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
  readonly employee: {
    readonly id: string;
    readonly employeeNumber: string;
    readonly user: { readonly displayName: string };
  };
  readonly items: readonly {
    readonly isDone: boolean;
    readonly deletedAt: Date | null;
  }[];
}

/**
 * Offboarding: one exit case per departing employee plus its clearance
 * checklist.
 *
 * Reads narrow to the caller's `offboarding:view` scope through the
 * employee's organizational unit, exactly like attendance records.
 */
@Injectable()
export class OffboardingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  async listCases(
    companyId: string,
    principal: SessionPrincipal,
    filter: OffboardingCaseQuery,
    params: PageParams,
  ): Promise<Paginated<OffboardingCaseSummary>> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: CASE_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await employeeScopeWhere(tx, decision, principal.user.id);
      return tx.offboardingCase.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...scopeWhere,
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.search
            ? {
                OR: [
                  {
                    reason: { contains: filter.search, mode: 'insensitive' as const },
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
            ? afterCaseCursor(resolved.cursor.position.values)
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { displayName: true } },
            },
          },
          items: { where: { deletedAt: null }, select: { isDone: true } },
        },
        take: params.limit + 1,
      }) as unknown as CaseRow[];
    });

    const items = rows.map(toCaseSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async createCase(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly employeeId: string;
      readonly reason: string;
      readonly lastWorkingDate: string;
      readonly exitInterviewNotes: string | null;
    },
  ): Promise<OffboardingCaseSummary> {
    const decision = this.readScope(principal);
    if (decision.kind !== 'all') {
      throw new OutOfScopeError('Offboarding requires company-wide data scope.');
    }

    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id: input.employeeId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (employee === null) {
        throw new NotFoundError('The employee does not exist.');
      }
      const existing = await tx.offboardingCase.findFirst({
        where: { companyId, employeeId: input.employeeId, deletedAt: null },
        select: { id: true },
      });
      if (existing !== null) {
        throw new ConflictError('An offboarding case already exists for this employee.');
      }
      const lastWorkingDate = new Date(input.lastWorkingDate);
      if (Number.isNaN(lastWorkingDate.getTime())) {
        throw new ValidationError('The last working date is not a valid date.');
      }
      return tx.offboardingCase.create({
        data: {
          companyId,
          employeeId: input.employeeId,
          reason: input.reason.trim(),
          lastWorkingDate,
          status: 'INITIATED',
          exitInterviewNotes: input.exitInterviewNotes,
          createdBy: principal.user.id,
          items: {
            create: DEFAULT_CHECKLIST.map((task) => ({
              companyId,
              task,
              createdBy: principal.user.id,
            })),
          },
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { displayName: true } },
            },
          },
          items: { where: { deletedAt: null }, select: { isDone: true } },
        },
      }) as unknown as CaseRow;
    });

    await this.audit(companyId, principal.user.id, 'offboarding.case_created', row.id, {
      employeeId: input.employeeId,
      reason: input.reason,
    });
    return toCaseSummary(row);
  }

  /** Advance a case: INITIATED → IN_CLEARANCE → CLEARED → COMPLETED. */
  async advanceCase(
    companyId: string,
    principal: SessionPrincipal,
    caseId: string,
  ): Promise<OffboardingCaseSummary> {
    const decision = this.readScope(principal);
    if (decision.kind !== 'all') {
      throw new OutOfScopeError('Offboarding requires company-wide data scope.');
    }
    const client = this.prisma.getClient();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const current = await tx.offboardingCase.findFirst({
        where: { id: caseId, companyId, deletedAt: null },
        include: { items: { where: { deletedAt: null }, select: { isDone: true } } },
      });
      if (current === null) {
        throw new NotFoundError('The offboarding case does not exist.');
      }
      if (current.status === 'IN_CLEARANCE' && current.items.some((item) => !item.isDone)) {
        throw new ConflictError('The clearance checklist still has open items.');
      }
      const nextStatus = nextCaseStatus(current.status);
      if (nextStatus === null) {
        throw new ValidationError(`The case status "${current.status}" cannot be advanced.`);
      }
      return tx.offboardingCase.update({
        where: { id: caseId },
        data: { status: nextStatus },
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { displayName: true } },
            },
          },
          items: { where: { deletedAt: null }, select: { isDone: true } },
        },
      }) as unknown as CaseRow;
    });

    await this.audit(companyId, principal.user.id, 'offboarding.case_advanced', caseId, {
      status: row.status,
    });
    return toCaseSummary(row);
  }

  /** Mark one checklist item done (or reopen it). */
  async setChecklistItemDone(
    companyId: string,
    principal: SessionPrincipal,
    itemId: string,
    isDone: boolean,
  ): Promise<void> {
    const decision = this.readScope(principal);
    if (decision.kind !== 'all') {
      throw new OutOfScopeError('Offboarding requires company-wide data scope.');
    }
    const client = this.prisma.getClient();

    await withTenantContext(client, companyId, async (tx) => {
      const item = await tx.offboardingChecklistItem.findFirst({
        where: { id: itemId, companyId, deletedAt: null },
        select: {
          id: true,
          isDone: true,
          caseId: true,
          case: { select: { status: true } },
        },
      });
      if (item === null) {
        throw new NotFoundError('The checklist item does not exist.');
      }
      if (item.case.status === 'COMPLETED') {
        throw new ConflictError('The case is completed; its checklist no longer changes.');
      }
      await tx.offboardingChecklistItem.update({
        where: { id: itemId },
        data: { isDone, completedAt: isDone ? new Date() : null },
      });
      // The first completed item moves a fresh case into clearance.
      if (item.case.status === 'INITIATED' && isDone) {
        await tx.offboardingCase.update({
          where: { id: item.caseId },
          data: { status: 'IN_CLEARANCE' },
        });
      }
    });

    await this.audit(companyId, principal.user.id, 'offboarding.checklist_updated', itemId, {
      isDone,
    });
  }

  private readScope(principal: SessionPrincipal): ScopeDecision {
    const decision = resolveScope(principal.permissions, 'offboarding', 'view', {
      userId: principal.user.id,
      unitId: principal.user.organizationalUnitId,
    });
    if (decision.kind === 'denied') {
      throw new OutOfScopeError(
        `Your "${decision.scope ?? 'unresolved'}" scope for offboarding.view cannot be resolved.`,
      );
    }
    return decision;
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
      resource: 'offboarding',
      resourceId,
      status: 'SUCCESS',
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action,
      resource: 'offboarding',
      resourceId,
      ...(payload === undefined ? {} : { payload }),
    });
  }
}

function nextCaseStatus(status: string): string | null {
  const index = CASE_STATUSES.indexOf(status as (typeof CASE_STATUSES)[number]);
  if (index < 0 || index >= CASE_STATUSES.length - 1) return null;
  return CASE_STATUSES[index + 1] ?? null;
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

function afterCaseCursor(values: readonly string[]): Record<string, unknown> {
  const createdAt = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] };
}

function toCaseSummary(row: CaseRow): OffboardingCaseSummary {
  const activeItems = row.items.filter((item) => item.deletedAt === null);
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.user.displayName,
    employeeNumber: row.employee.employeeNumber,
    reason: row.reason,
    lastWorkingDate: row.lastWorkingDate.toISOString(),
    status: row.status,
    exitInterviewNotes: row.exitInterviewNotes,
    checklistTotal: activeItems.length,
    checklistDone: activeItems.filter((item) => item.isDone).length,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
