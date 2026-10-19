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
  type PayrollPeriodQuery,
  type PayrollPeriodSummary,
  type PayrollRunQuery,
  type PayrollRunSummary,
  type SalaryStructureQuery,
  type SalaryStructureSummary,
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

const PERIOD_SORT = { startDate: 'desc', id: 'desc' } as const;
const RUN_SORT = { createdAt: 'desc', id: 'desc' } as const;
const SALARY_SORT = { effectiveFrom: 'desc', id: 'desc' } as const;

const PERIOD_STATUSES = ['DRAFT', 'OPEN', 'PROCESSING', 'APPROVED', 'PAID', 'CLOSED'] as const;

interface PayrollPeriodRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly payDate: Date | null;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
}

interface SalaryStructureRow {
  readonly id: string;
  readonly positionId: string;
  readonly baseSalary: Prisma.Decimal;
  readonly currency: string;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
  readonly position: { readonly id: string; readonly name: string };
}

interface PayrollRunRow {
  readonly id: string;
  readonly periodId: string;
  readonly baseSalary: Prisma.Decimal;
  readonly totalEarnings: Prisma.Decimal;
  readonly totalDeductions: Prisma.Decimal;
  readonly netPay: Prisma.Decimal;
  readonly status: string;
  readonly paidAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
  readonly period: { readonly id: string; readonly code: string };
  readonly employee: {
    readonly id: string;
    readonly employeeNumber: string;
    readonly user: { readonly displayName: string };
  };
  readonly components?: readonly {
    readonly id: string;
    readonly runId: string;
    readonly component: string;
    readonly type: string;
    readonly amount: Prisma.Decimal;
  }[];
}

/**
 * Payroll: pay periods, salary structures and per-employee payroll
 * calculation.
 *
 * Every read and mutation runs inside `withTenantContext`. Reads narrow to the
 * caller's `payroll:view` data scope; mutations are limited to `all` scope
 * because payroll touches every employee's compensation.
 */
@Injectable()
export class PayrollService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  // ---------------------------------------------------------------------------
  // Payroll periods
  // ---------------------------------------------------------------------------

  async listPeriods(
    companyId: string,
    principal: SessionPrincipal,
    filter: PayrollPeriodQuery,
    params: PageParams,
  ): Promise<Paginated<PayrollPeriodSummary>> {
    this.readScopeOrThrow(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: PERIOD_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(
      client,
      companyId,
      async (tx) =>
        tx.payrollPeriod.findMany({
          where: {
            companyId,
            deletedAt: null,
            ...(filter.status ? { status: filter.status } : {}),
            ...(filter.search ? { OR: periodSearchWhere(filter.search) } : {}),
            ...(resolved.cursor.position.values.length > 0
              ? afterPeriodCursor(resolved.cursor.position.values)
              : {}),
          },
          orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
          take: params.limit + 1,
        }) as unknown as PayrollPeriodRow[],
    );

    const items = rows.map(toPeriodSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.startDate, item.id],
    }));
  }

  async createPeriod(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly code: string;
      readonly name: string;
      readonly startDate: string;
      readonly endDate: string;
      readonly payDate: string | null;
    },
  ): Promise<PayrollPeriodSummary> {
    this.assertAllScope(principal);
    if (new Date(input.startDate) > new Date(input.endDate)) {
      throw new ValidationError('The period start date must be before the end date.');
    }

    const client = this.prisma.getClient();
    const code = input.code.trim();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const clash = await tx.payrollPeriod.findFirst({
        where: { companyId, code, deletedAt: null },
        select: { id: true },
      });
      if (clash !== null) {
        throw new ConflictError(`A payroll period with the code "${code}" already exists.`);
      }
      return tx.payrollPeriod.create({
        data: {
          companyId,
          code,
          name: input.name.trim(),
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          payDate: input.payDate === null ? null : new Date(input.payDate),
          status: 'DRAFT',
          createdBy: principal.user.id,
        },
      }) as unknown as PayrollPeriodRow;
    });

    await this.audit(companyId, principal.user.id, 'payroll.period_created', row.id, { code });
    return toPeriodSummary(row);
  }

  /** Advance a period's lifecycle: DRAFT → OPEN → PROCESSING → APPROVED → PAID → CLOSED. */
  async advancePeriod(
    companyId: string,
    principal: SessionPrincipal,
    periodId: string,
  ): Promise<PayrollPeriodSummary> {
    this.assertAllScope(principal);
    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const current = await tx.payrollPeriod.findFirst({
        where: { id: periodId, companyId, deletedAt: null },
      });
      if (current === null) {
        throw new NotFoundError('The payroll period does not exist.');
      }
      const nextStatus = nextPeriodStatus(current.status);
      if (nextStatus === null) {
        throw new ValidationError(
          `The period status "${current.status}" cannot be advanced further.`,
        );
      }
      if (nextStatus === 'PAID' && current.payDate === null) {
        throw new ValidationError('Set a pay date before marking the period as paid.');
      }
      return tx.payrollPeriod.update({
        where: { id: periodId },
        data: { status: nextStatus },
      }) as unknown as PayrollPeriodRow;
    });

    await this.audit(companyId, principal.user.id, 'payroll.period_advanced', periodId, {
      status: row.status,
    });
    return toPeriodSummary(row);
  }

  // ---------------------------------------------------------------------------
  // Salary structures
  // ---------------------------------------------------------------------------

  async listSalaryStructures(
    companyId: string,
    principal: SessionPrincipal,
    filter: SalaryStructureQuery,
    params: PageParams,
  ): Promise<Paginated<SalaryStructureSummary>> {
    this.readScopeOrThrow(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: SALARY_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(
      client,
      companyId,
      async (tx) =>
        tx.salaryStructure.findMany({
          where: {
            companyId,
            deletedAt: null,
            ...(filter.positionId ? { positionId: filter.positionId } : {}),
            ...(filter.search
              ? { position: { name: { contains: filter.search, mode: 'insensitive' as const } } }
              : {}),
            ...(resolved.cursor.position.values.length > 0
              ? afterSalaryCursor(resolved.cursor.position.values)
              : {}),
          },
          orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
          include: { position: { select: { id: true, name: true } } },
          take: params.limit + 1,
        }) as unknown as SalaryStructureRow[],
    );

    const items = rows.map(toSalaryStructureSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.effectiveFrom, item.id],
    }));
  }

  async createSalaryStructure(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly positionId: string;
      readonly baseSalary: number;
      readonly currency: string;
      readonly effectiveFrom: string;
      readonly effectiveTo: string | null;
      readonly isActive: boolean;
    },
  ): Promise<SalaryStructureSummary> {
    this.assertAllScope(principal);
    if (input.baseSalary < 0) {
      throw new ValidationError('The base salary cannot be negative.');
    }

    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const position = await tx.position.findFirst({
        where: { id: input.positionId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (position === null) {
        throw new NotFoundError('The position does not exist.');
      }
      return tx.salaryStructure.create({
        data: {
          companyId,
          positionId: input.positionId,
          baseSalary: input.baseSalary,
          currency: input.currency,
          effectiveFrom: new Date(input.effectiveFrom),
          effectiveTo: input.effectiveTo === null ? null : new Date(input.effectiveTo),
          isActive: input.isActive,
          createdBy: principal.user.id,
        },
        include: { position: { select: { id: true, name: true } } },
      }) as unknown as SalaryStructureRow;
    });

    await this.audit(companyId, principal.user.id, 'payroll.salary_created', row.id);
    return toSalaryStructureSummary(row);
  }

  // ---------------------------------------------------------------------------
  // Payroll runs
  // ---------------------------------------------------------------------------

  async listRuns(
    companyId: string,
    principal: SessionPrincipal,
    filter: PayrollRunQuery,
    params: PageParams,
  ): Promise<Paginated<PayrollRunSummary>> {
    const decision = this.readScopeOrThrow(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: RUN_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await employeeScopeWhere(tx, decision, principal.user.id);
      return tx.payrollRun.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...scopeWhere,
          ...(filter.periodId ? { periodId: filter.periodId } : {}),
          ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.search ? { OR: runSearchWhere(filter.search) } : {}),
          ...(resolved.cursor.position.values.length > 0
            ? afterRunCursor(resolved.cursor.position.values)
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          period: { select: { id: true, code: true } },
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { displayName: true } },
            },
          },
        },
        take: params.limit + 1,
      }) as unknown as PayrollRunRow[];
    });

    const items = rows.map(toRunSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  /** Calculate (or recalculate) one employee's payroll for a period. */
  async calculateRun(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly periodId: string;
      readonly employeeId: string;
      readonly components: readonly { readonly component: string; readonly amount: number }[];
    },
  ): Promise<PayrollRunSummary> {
    this.assertAllScope(principal);
    const client = this.prisma.getClient();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const period = await tx.payrollPeriod.findFirst({
        where: { id: input.periodId, companyId, deletedAt: null },
      });
      if (period === null) {
        throw new NotFoundError('The payroll period does not exist.');
      }
      if (period.status === 'PAID' || period.status === 'CLOSED') {
        throw new ConflictError('The payroll period is locked; runs can no longer change.');
      }

      const employee = await tx.employee.findFirst({
        where: { id: input.employeeId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (employee === null) {
        throw new NotFoundError('The employee does not exist.');
      }

      const salaryStructure = await tx.salaryStructure.findFirst({
        where: {
          companyId,
          deletedAt: null,
          isActive: true,
          effectiveFrom: { lte: period.startDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.endDate } }],
          position: { employees: { some: { id: input.employeeId } } },
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (salaryStructure === null) {
        throw new ValidationError(
          'No active salary structure covers this employee for the selected period.',
        );
      }

      const earnings = input.components
        .filter((c) => c.amount >= 0)
        .map((c) => ({ component: c.component.trim(), type: 'EARNING', amount: c.amount }));
      const baseSalary = Number(salaryStructure.baseSalary);
      const totalEarnings = baseSalary + earnings.reduce((sum, c) => sum + c.amount, 0);

      const existing = await tx.payrollRun.findFirst({
        where: { periodId: input.periodId, employeeId: input.employeeId, deletedAt: null },
      });
      if (existing !== null) {
        throw new ConflictError('A payroll run already exists for this employee in this period.');
      }

      const created = (await tx.payrollRun.create({
        data: {
          companyId,
          periodId: input.periodId,
          employeeId: input.employeeId,
          baseSalary,
          totalEarnings,
          totalDeductions: 0,
          netPay: totalEarnings,
          status: 'DRAFT',
          createdBy: principal.user.id,
          components: {
            create: [
              { companyId, component: 'Base salary', type: 'EARNING', amount: baseSalary },
              ...earnings.map((c) => ({ companyId, ...c })),
            ],
          },
        },
        include: {
          period: { select: { id: true, code: true } },
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { displayName: true } },
            },
          },
          components: true,
        },
      })) as unknown as PayrollRunRow;
      return created;
    });

    await this.audit(companyId, principal.user.id, 'payroll.run_calculated', row.id, {
      periodId: input.periodId,
      employeeId: input.employeeId,
      netPay: Number(row.netPay),
    });
    return toRunSummary(row);
  }

  /** Approve a payroll run: DRAFT → APPROVED → PAID. */
  async advanceRun(
    companyId: string,
    principal: SessionPrincipal,
    runId: string,
  ): Promise<PayrollRunSummary> {
    this.assertAllScope(principal);
    const client = this.prisma.getClient();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const current = await tx.payrollRun.findFirst({
        where: { id: runId, companyId, deletedAt: null },
      });
      if (current === null) {
        throw new NotFoundError('The payroll run does not exist.');
      }
      const nextStatus = nextRunStatus(current.status);
      if (nextStatus === null) {
        throw new ValidationError(`The run status "${current.status}" cannot be advanced further.`);
      }
      const now = new Date();
      return tx.payrollRun.update({
        where: { id: runId },
        data: {
          status: nextStatus,
          ...(nextStatus === 'PAID' ? { paidAt: now } : {}),
        },
        include: {
          period: { select: { id: true, code: true } },
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { displayName: true } },
            },
          },
          components: true,
        },
      }) as unknown as PayrollRunRow;
    });

    await this.audit(companyId, principal.user.id, 'payroll.run_advanced', runId, {
      status: row.status,
    });
    return toRunSummary(row);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private readScopeOrThrow(principal: SessionPrincipal): ScopeDecision {
    const decision = resolveScope(principal.permissions, 'payroll', 'view', {
      userId: principal.user.id,
      unitId: principal.user.organizationalUnitId,
    });
    if (decision.kind === 'denied') {
      throw new OutOfScopeError(
        `Your "${decision.scope ?? 'unresolved'}" scope for payroll.view cannot be resolved.`,
      );
    }
    return decision;
  }

  private assertAllScope(principal: SessionPrincipal): void {
    const decision = this.readScopeOrThrow(principal);
    if (decision.kind !== 'all') {
      throw new OutOfScopeError('Payroll mutations require company-wide data scope.');
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
      resource: 'payroll',
      resourceId,
      status: 'SUCCESS',
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action,
      resource: 'payroll',
      resourceId,
      ...(payload === undefined ? {} : { payload }),
    });
  }
}

function nextPeriodStatus(status: string): string | null {
  const index = PERIOD_STATUSES.indexOf(status as (typeof PERIOD_STATUSES)[number]);
  if (index < 0 || index >= PERIOD_STATUSES.length - 1) return null;
  return PERIOD_STATUSES[index + 1] ?? null;
}

function nextRunStatus(status: string): string | null {
  switch (status) {
    case 'DRAFT':
      return 'APPROVED';
    case 'APPROVED':
      return 'PAID';
    default:
      return null;
  }
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

function decimal(value: Prisma.Decimal): number {
  return Number(value);
}

function periodSearchWhere(search: string): Record<string, unknown>[] {
  const q = search.trim();
  if (q.length === 0) return [];
  return [
    { name: { contains: q, mode: 'insensitive' as const } },
    { code: { contains: q, mode: 'insensitive' as const } },
  ];
}

function runSearchWhere(search: string): Record<string, unknown>[] {
  const q = search.trim();
  if (q.length === 0) return [];
  return [
    { employee: { user: { displayName: { contains: q, mode: 'insensitive' as const } } } },
    { employee: { employeeNumber: { contains: q, mode: 'insensitive' as const } } },
  ];
}

function afterPeriodCursor(values: readonly string[]): Record<string, unknown> {
  const startDate = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ startDate: { lt: startDate } }, { startDate, id: { lt: id } }] };
}

function afterSalaryCursor(values: readonly string[]): Record<string, unknown> {
  const effectiveFrom = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ effectiveFrom: { lt: effectiveFrom } }, { effectiveFrom, id: { lt: id } }] };
}

function afterRunCursor(values: readonly string[]): Record<string, unknown> {
  const createdAt = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] };
}

function toPeriodSummary(row: PayrollPeriodRow): PayrollPeriodSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    payDate: row.payDate?.toISOString() ?? null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSalaryStructureSummary(row: SalaryStructureRow): SalaryStructureSummary {
  return {
    id: row.id,
    positionId: row.positionId,
    positionTitle: row.position.name,
    baseSalary: decimal(row.baseSalary),
    currency: row.currency,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRunSummary(row: PayrollRunRow): PayrollRunSummary {
  return {
    id: row.id,
    periodId: row.periodId,
    periodCode: row.period.code,
    employeeId: row.employee.id,
    employeeName: row.employee.user.displayName,
    employeeNumber: row.employee.employeeNumber,
    baseSalary: decimal(row.baseSalary),
    totalEarnings: decimal(row.totalEarnings),
    totalDeductions: decimal(row.totalDeductions),
    netPay: decimal(row.netPay),
    status: row.status,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
