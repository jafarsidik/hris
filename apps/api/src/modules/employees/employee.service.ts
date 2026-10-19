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
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  type EmployeeQuery,
  type EmployeeSummary,
  type PageParams,
  type Paginated,
  type PositionQuery,
  type PositionSummary,
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

export interface EmployeeActor {
  readonly companyId: string;
  readonly userId: string;
}

const EMPLOYEE_SORT = { createdAt: 'desc', id: 'desc' } as const;
const POSITION_SORT = { createdAt: 'asc', id: 'asc' } as const;

interface EmployeeRow {
  readonly id: string;
  readonly employeeNumber: string;
  readonly employmentType: string;
  readonly status: string;
  readonly hireDate: Date;
  readonly terminationDate: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
  readonly user: { readonly id: string; readonly email: string; readonly displayName: string };
  readonly unit: { readonly id: string; readonly name: string } | null;
  readonly jobPosition: { readonly id: string; readonly name: string } | null;
}

interface PositionRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly unit: { readonly id: string; readonly name: string } | null;
  readonly jobGrade: string | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
}

/**
 * Employee master data: employment records that link a `User` identity to an
 * organizational unit and a position.
 *
 * Every read and mutation runs inside `withTenantContext`, so row-level security
 * keeps the tenant boundary. Reads narrow to the caller's `employee:view` data
 * scope: `all` sees the whole company, `subtree` sees employees in their unit's
 * subtree, `entity` sees employees in their legal entity, and `self` sees only
 * their own record. Writes require the target to fall inside that same scope.
 */
@Injectable()
export class EmployeeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  // ---------------------------------------------------------------------------
  // Employees
  // ---------------------------------------------------------------------------

  async listEmployees(
    companyId: string,
    principal: SessionPrincipal,
    filter: EmployeeQuery,
    params: PageParams,
  ): Promise<Paginated<EmployeeSummary>> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: EMPLOYEE_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await employeeScopeWhere(tx, decision, principal.user.id);
      return tx.employee.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...scopeWhere,
          ...(filter.search ? { OR: employeeSearchWhere(filter.search) } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.employmentType ? { employmentType: filter.employmentType } : {}),
          ...(filter.department
            ? { unit: { name: { contains: filter.department, mode: 'insensitive' } } }
            : {}),
          ...(resolved.cursor.position.values.length > 0
            ? afterEmployeeCursor(resolved.cursor.position.values)
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          unit: { select: { id: true, name: true } },
          jobPosition: { select: { id: true, name: true } },
        },
        take: params.limit + 1,
      }) as unknown as EmployeeRow[];
    });

    const items = rows.map(toEmployeeSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async getEmployee(
    companyId: string,
    principal: SessionPrincipal,
    employeeId: string,
  ): Promise<EmployeeSummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await employeeScopeWhere(tx, decision, principal.user.id);
      return tx.employee.findFirst({
        where: { id: employeeId, companyId, deletedAt: null, ...scopeWhere },
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          unit: { select: { id: true, name: true } },
          jobPosition: { select: { id: true, name: true } },
        },
      }) as unknown as EmployeeRow | null;
    });
    if (row === null) {
      throw new NotFoundError('The employee record does not exist.');
    }
    return toEmployeeSummary(row);
  }

  async createEmployee(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      /** Blank means: resolve (or mint) the backing user from `userEmail`. */
      readonly userId?: string;
      readonly userName?: string;
      readonly userEmail?: string;
      /** Blank means: allocate the company's next employee number. */
      readonly employeeNumber?: string;
      readonly organizationalUnitId: string | null;
      readonly positionId: string | null;
      readonly employmentType: string;
      readonly status: string;
      readonly hireDate: string;
    },
  ): Promise<EmployeeSummary> {
    const decision = this.readScope(principal);
    if (decision.kind !== 'all') {
      throw new OutOfScopeError('Your scope does not allow creating employee records.');
    }
    if (!(EMPLOYMENT_TYPES as readonly string[]).includes(input.employmentType)) {
      throw new ValidationError('Choose an employment type from the platform enums.');
    }
    if (!(EMPLOYEE_STATUSES as readonly string[]).includes(input.status)) {
      throw new ValidationError('Choose a status from the platform enum.');
    }
    const userIdCandidate = (input.userId ?? '').trim();
    const userEmail = (input.userEmail ?? '').trim().toLowerCase();
    if (userIdCandidate === '' && userEmail === '') {
      throw new ValidationError('Provide an existing user id or a user email for the employee.');
    }
    const displayName = (input.userName ?? '').trim() || userEmail.split('@')[0] || 'Employee';

    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      let userId = userIdCandidate;
      if (userId === '') {
        // The user is the identity behind the employee record. When the form names a
        // person rather than picking an account, the first add finds an existing match
        // by email (linking, not duplicating) and otherwise mints an ACTIVE user.
        const existingUser = await tx.user.findFirst({
          where: { companyId, email: userEmail },
          select: { id: true },
        });
        let mintedId = existingUser?.id;
        if (mintedId === undefined) {
          const minted = await tx.user.create({
            data: {
              companyId,
              email: userEmail,
              displayName,
              status: 'ACTIVE',
            },
            select: { id: true },
          });
          mintedId = minted.id;
        }
        userId = mintedId;
      } else {
        const user = await tx.user.findFirst({
          where: { companyId, id: userId },
          select: { id: true },
        });
        if (user === null) {
          throw new NotFoundError('The backing user for this employee does not exist.');
        }
      }

      let employeeNumber = (input.employeeNumber ?? '').trim();
      if (employeeNumber === '') {
        employeeNumber = await this.nextEmployeeNumber(tx, companyId);
      }
      await this.assertEmployeeNumberFree(tx, companyId, employeeNumber, null);
      await this.assertPlacementInScope(
        tx,
        decision,
        principal,
        input.organizationalUnitId,
        input.positionId,
      );
      return tx.employee.create({
        data: {
          companyId,
          userId,
          employeeNumber,
          organizationalUnit: input.organizationalUnitId,
          position: input.positionId,
          employmentType: input.employmentType,
          status: input.status,
          hireDate: new Date(input.hireDate),
          createdBy: principal.user.id,
        },
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          unit: { select: { id: true, name: true } },
          jobPosition: { select: { id: true, name: true } },
        },
      }) as unknown as EmployeeRow;
    });

    await this.audit(companyId, principal.user.id, 'employee.created', row.id, {
      employeeNumber: row.employeeNumber,
      userId: row.user.id,
    });
    return toEmployeeSummary(row);
  }

  async updateEmployee(
    companyId: string,
    principal: SessionPrincipal,
    employeeId: string,
    input: {
      readonly employeeNumber?: string;
      readonly organizationalUnitId?: string | null;
      readonly positionId?: string | null;
      readonly employmentType?: string;
      readonly status?: string;
      readonly hireDate?: string;
      readonly terminationDate?: string | null;
    },
  ): Promise<EmployeeSummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const employeeNumber =
      input.employeeNumber === undefined ? undefined : input.employeeNumber.trim();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await employeeScopeWhere(tx, decision, principal.user.id);
      const current = await tx.employee.findFirst({
        where: { id: employeeId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The employee record does not exist.');
      }
      if (employeeNumber !== undefined) {
        await this.assertEmployeeNumberFree(tx, companyId, employeeNumber, employeeId);
      }
      const nextUnitId =
        input.organizationalUnitId === undefined ? null : input.organizationalUnitId;
      const nextPositionId = input.positionId === undefined ? null : input.positionId;
      if (input.organizationalUnitId !== undefined || input.positionId !== undefined) {
        await this.assertPlacementInScope(tx, decision, principal, nextUnitId, nextPositionId);
      }

      return tx.employee.update({
        where: { id: employeeId },
        data: {
          ...(employeeNumber === undefined ? {} : { employeeNumber }),
          ...(input.organizationalUnitId === undefined
            ? {}
            : { organizationalUnit: input.organizationalUnitId }),
          ...(input.positionId === undefined ? {} : { position: input.positionId }),
          ...(input.employmentType === undefined ? {} : { employmentType: input.employmentType }),
          ...(input.status === undefined ? {} : { status: input.status }),
          ...(input.hireDate === undefined ? {} : { hireDate: new Date(input.hireDate) }),
          ...(input.terminationDate === undefined
            ? {}
            : {
                terminationDate:
                  input.terminationDate === null ? null : new Date(input.terminationDate),
              }),
        },
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          unit: { select: { id: true, name: true } },
          jobPosition: { select: { id: true, name: true } },
        },
      }) as unknown as EmployeeRow;
    });

    await this.audit(companyId, principal.user.id, 'employee.updated', employeeId);
    return toEmployeeSummary(row);
  }

  async deleteEmployee(
    companyId: string,
    principal: SessionPrincipal,
    employeeId: string,
  ): Promise<void> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();

    await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await employeeScopeWhere(tx, decision, principal.user.id);
      const current = await tx.employee.findFirst({
        where: { id: employeeId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The employee record does not exist.');
      }
      await tx.employee.update({ where: { id: employeeId }, data: { deletedAt: new Date() } });
    });

    await this.audit(companyId, principal.user.id, 'employee.deleted', employeeId);
  }

  // ---------------------------------------------------------------------------
  // Positions
  // ---------------------------------------------------------------------------

  async listPositions(
    companyId: string,
    principal: SessionPrincipal,
    filter: PositionQuery,
    params: PageParams,
  ): Promise<Paginated<PositionSummary>> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: POSITION_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await positionScopeWhere(
        tx,
        decision,
        principal.user.organizationalUnitId,
      );
      return tx.position.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...scopeWhere,
          ...(filter.unitId ? { organizationalUnit: filter.unitId } : {}),
          ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
          ...(filter.search ? { OR: positionSearchWhere(filter.search) } : {}),
          ...(resolved.cursor.position.values.length > 0
            ? afterPositionCursor(resolved.cursor.position.values)
            : {}),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          unit: { select: { id: true, name: true } },
        },
        take: params.limit + 1,
      }) as unknown as PositionRow[];
    });

    const items = rows.map(toPositionSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async getPosition(
    companyId: string,
    principal: SessionPrincipal,
    positionId: string,
  ): Promise<PositionSummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await positionScopeWhere(
        tx,
        decision,
        principal.user.organizationalUnitId,
      );
      return tx.position.findFirst({
        where: { id: positionId, companyId, deletedAt: null, ...scopeWhere },
        include: {
          unit: { select: { id: true, name: true } },
        },
      }) as unknown as PositionRow | null;
    });
    if (row === null) {
      throw new NotFoundError('The position does not exist.');
    }
    return toPositionSummary(row);
  }

  async createPosition(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly code: string;
      readonly name: string;
      readonly description: string | null;
      readonly organizationalUnitId: string | null;
      readonly jobGrade: string | null;
      readonly isActive: boolean;
    },
  ): Promise<PositionSummary> {
    const decision = this.readScope(principal);
    if (decision.kind !== 'all') {
      throw new OutOfScopeError('Your scope does not allow creating positions.');
    }

    const client = this.prisma.getClient();
    const code = input.code.trim();
    const row = await withTenantContext(client, companyId, async (tx) => {
      await this.assertPositionCodeFree(tx, companyId, code, null);
      return tx.position.create({
        data: {
          companyId,
          code,
          name: input.name.trim(),
          description: input.description,
          organizationalUnit: input.organizationalUnitId,
          jobGrade: input.jobGrade,
          isActive: input.isActive,
          createdBy: principal.user.id,
        },
        include: {
          unit: { select: { id: true, name: true } },
        },
      }) as unknown as PositionRow;
    });

    await this.audit(companyId, principal.user.id, 'position.created', row.id, {
      code,
      name: row.name,
    });
    return toPositionSummary(row);
  }

  async updatePosition(
    companyId: string,
    principal: SessionPrincipal,
    positionId: string,
    input: {
      readonly code?: string;
      readonly name?: string;
      readonly description?: string | null;
      readonly organizationalUnitId?: string | null;
      readonly jobGrade?: string | null;
      readonly isActive?: boolean;
    },
  ): Promise<PositionSummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const code = input.code === undefined ? undefined : input.code.trim();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await positionScopeWhere(
        tx,
        decision,
        principal.user.organizationalUnitId,
      );
      const current = await tx.position.findFirst({
        where: { id: positionId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The position does not exist.');
      }
      if (code !== undefined) {
        await this.assertPositionCodeFree(tx, companyId, code, positionId);
      }

      return tx.position.update({
        where: { id: positionId },
        data: {
          ...(code === undefined ? {} : { code }),
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.organizationalUnitId === undefined
            ? {}
            : { organizationalUnit: input.organizationalUnitId }),
          ...(input.jobGrade === undefined ? {} : { jobGrade: input.jobGrade }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
        include: {
          unit: { select: { id: true, name: true } },
        },
      }) as unknown as PositionRow;
    });

    await this.audit(companyId, principal.user.id, 'position.updated', positionId);
    return toPositionSummary(row);
  }

  async deletePosition(
    companyId: string,
    principal: SessionPrincipal,
    positionId: string,
  ): Promise<void> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();

    await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await positionScopeWhere(
        tx,
        decision,
        principal.user.organizationalUnitId,
      );
      const current = await tx.position.findFirst({
        where: { id: positionId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The position does not exist.');
      }
      const employees = await tx.employee.count({
        where: { position: positionId, companyId, deletedAt: null },
      });
      if (employees > 0) {
        throw new ConflictError('Reassign the position\u2019s employees before deleting it.');
      }
      await tx.position.update({ where: { id: positionId }, data: { deletedAt: new Date() } });
    });

    await this.audit(companyId, principal.user.id, 'position.deleted', positionId);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private readScope(principal: SessionPrincipal): ScopeDecision {
    const decision = resolveScope(principal.permissions, 'employee', 'view', {
      userId: principal.user.id,
      unitId: principal.user.organizationalUnitId,
    });
    if (decision.kind === 'denied') {
      throw new OutOfScopeError(
        `Your "${decision.scope ?? 'unresolved'}" scope for employee.view cannot be resolved.`,
      );
    }
    return decision;
  }

  private async assertPlacementInScope(
    tx: Prisma.TransactionClient,
    decision: ScopeDecision,
    principal: SessionPrincipal,
    unitId: string | null,
    positionId: string | null,
  ): Promise<void> {
    if (decision.kind === 'all') {
      if (unitId !== null) {
        const unit = await tx.organizationalUnit.findFirst({
          where: { id: unitId, deletedAt: null },
          select: { id: true },
        });
        if (unit === null) {
          throw new ValidationError('The selected organizational unit does not exist.');
        }
      }
      if (positionId !== null) {
        const position = await tx.position.findFirst({
          where: { id: positionId, deletedAt: null },
          select: { id: true },
        });
        if (position === null) {
          throw new ValidationError('The selected position does not exist.');
        }
      }
      return;
    }

    if (unitId !== null) {
      const scopeWhere = await employeeScopeWhere(tx, decision, principal.user.id);
      const unit = await tx.organizationalUnit.findFirst({
        where: { id: unitId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (unit === null) {
        throw new OutOfScopeError('The organizational unit is outside your permitted scope.');
      }
    }

    if (positionId !== null) {
      const position = await tx.position.findFirst({
        where: { id: positionId, deletedAt: null },
        select: { id: true, organizationalUnit: true },
      });
      if (position === null) {
        throw new ValidationError('The selected position does not exist.');
      }
    }
  }

  /**
   * Allocates the company's next employee number: the highest existing `EMP-nnnn`
   * plus one, retried if the row was taken between reads. Numbers are per company,
   * so the walk is scoped to this company's rows only.
   */
  private async nextEmployeeNumber(
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<string> {
    const taken = new Set(
      (
        await tx.employee.findMany({
          where: { companyId, employeeNumber: { startsWith: 'EMP-' } },
          select: { employeeNumber: true },
        })
      ).map((row) => row.employeeNumber.toUpperCase()),
    );
    for (let candidate = taken.size + 1; candidate < taken.size + 100; candidate += 1) {
      const number = `EMP-${String(candidate).padStart(4, '0')}`;
      if (!taken.has(number)) {
        return number;
      }
    }
    throw new ConflictError('No free employee number could be allocated; assign one manually.');
  }

  private async assertEmployeeNumberFree(
    tx: Prisma.TransactionClient,
    companyId: string,
    employeeNumber: string,
    excludeId: string | null,
  ): Promise<void> {
    const clash = await tx.employee.findFirst({
      where: {
        companyId,
        employeeNumber,
        deletedAt: null,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    if (clash !== null) {
      throw new ConflictError(`An employee with the number "${employeeNumber}" already exists.`);
    }
  }

  private async assertPositionCodeFree(
    tx: Prisma.TransactionClient,
    companyId: string,
    code: string,
    excludeId: string | null,
  ): Promise<void> {
    const clash = await tx.position.findFirst({
      where: {
        companyId,
        code,
        deletedAt: null,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    if (clash !== null) {
      throw new ConflictError(`A position with the code "${code}" already exists.`);
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
      resource: 'employee',
      resourceId,
      status: 'SUCCESS',
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action,
      resource: 'employee',
      resourceId,
      ...(payload === undefined ? {} : { payload }),
    });
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
      return { userId: callerUserId };
    case 'subtree': {
      const unitIds = await findOrgUnitSubtree(tx, decision.rootUnitId);
      return unitIds.length > 0
        ? { organizationalUnit: { in: unitIds } }
        : { organizationalUnit: { in: [] } };
    }
    case 'entity': {
      const entityId = await findOrgUnitEntity(tx, decision.rootUnitId);
      return entityId ? { unit: { entityId } } : { organizationalUnit: { in: [] } };
    }
    default:
      return { organizationalUnit: { in: [] } };
  }
}

async function positionScopeWhere(
  tx: Prisma.TransactionClient,
  decision: ScopeDecision,
  callerUnitId: string | null,
): Promise<Record<string, unknown>> {
  switch (decision.kind) {
    case 'all':
      return {};
    case 'self':
      return callerUnitId
        ? { organizationalUnit: callerUnitId }
        : { organizationalUnit: { in: [] } };
    case 'subtree': {
      const unitIds = await findOrgUnitSubtree(tx, decision.rootUnitId);
      return unitIds.length > 0
        ? { organizationalUnit: { in: unitIds } }
        : { organizationalUnit: { in: [] } };
    }
    case 'entity': {
      const entityId = await findOrgUnitEntity(tx, decision.rootUnitId);
      return entityId ? { unit: { entityId } } : { organizationalUnit: { in: [] } };
    }
    default:
      return { organizationalUnit: { in: [] } };
  }
}

function employeeSearchWhere(search: string): Record<string, unknown>[] {
  const q = search.trim();
  if (q.length === 0) {
    return [];
  }
  return [
    { employeeNumber: { contains: q, mode: 'insensitive' } },
    { user: { displayName: { contains: q, mode: 'insensitive' } } },
    { user: { email: { contains: q, mode: 'insensitive' } } },
  ];
}

function positionSearchWhere(search: string): Record<string, unknown>[] {
  const q = search.trim();
  if (q.length === 0) {
    return [];
  }
  return [
    { code: { contains: q, mode: 'insensitive' } },
    { name: { contains: q, mode: 'insensitive' } },
  ];
}

function afterEmployeeCursor(values: readonly string[]): Record<string, unknown> {
  const createdAt = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] };
}

function afterPositionCursor(values: readonly string[]): Record<string, unknown> {
  const createdAt = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] };
}

function toEmployeeSummary(row: EmployeeRow): EmployeeSummary {
  return {
    id: row.id,
    employeeNumber: row.employeeNumber,
    fullName: row.user.displayName,
    email: row.user.email,
    jobTitle: row.jobPosition?.name ?? '',
    department: row.unit?.name ?? null,
    employmentType: row.employmentType,
    hireDate: row.hireDate.toISOString(),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPositionSummary(row: PositionRow): PositionSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    organizationalUnitId: row.unit?.id ?? null,
    organizationalUnitName: row.unit?.name ?? null,
    jobGrade: row.jobGrade,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
