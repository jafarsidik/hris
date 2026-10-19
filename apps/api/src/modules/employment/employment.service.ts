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
  type EmployeeMovementSummary,
  type EmploymentQuery,
  type EmploymentContractSummary,
  type Paginated,
  type PageParams,
} from '@hris/shared-types';

import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';
import { resolveScope, type ScopeDecision } from '../../common/auth/data-scope';
import { type SessionPrincipal } from '../../common/auth/permission.service';
import { NotFoundError, OutOfScopeError, ValidationError } from '../../common/errors/app-error';

const SORT = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

const EMPLOYEE_FIELDS = {
  employee: {
    select: { id: true, employeeNumber: true, user: { select: { displayName: true } } },
  },
} as const;

interface EmployeeReadRow {
  readonly id: string;
  readonly employeeNumber: string;
  readonly user: { readonly displayName: string };
}

interface ContractRow {
  readonly id: string;
  readonly contractNumber: string;
  readonly contractType: string;
  readonly startDate: Date;
  readonly endDate: Date | null;
  readonly status: string;
  readonly signedDate: Date | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly employee: EmployeeReadRow;
}

interface MovementRow {
  readonly id: string;
  readonly movementType: string;
  readonly effectiveDate: Date;
  readonly fromUnitName: string | null;
  readonly toUnitName: string | null;
  readonly fromPositionName: string | null;
  readonly toPositionName: string | null;
  readonly reason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly employee: EmployeeReadRow;
}

/**
 * Employment agreements and organizational movements.
 *
 * Reads narrow to the caller's `employee:view` scope through the owning
 * employee's organizational unit. Writes require company-wide scope.
 * Creating a movement with a target unit or position also moves the
 * employee onto it, in the same transaction.
 */
@Injectable()
export class EmploymentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  // ---------------------------------------------------------------------------
  // Contracts
  // ---------------------------------------------------------------------------

  async listContracts(
    companyId: string,
    principal: SessionPrincipal,
    filter: EmploymentQuery,
    params: PageParams,
    probationOnly = false,
  ): Promise<Paginated<EmploymentContractSummary>> {
    const type = probationOnly ? 'PROBATION' : filter.type;
    const { where, fingerprint, take } = await this.listArgs(
      companyId,
      principal,
      { ...filter, type },
      params,
    );
    const client = this.prisma.getClient();
    const rows = await withTenantContext(
      client,
      companyId,
      async (tx) =>
        tx.employmentContract.findMany({
          where,
          orderBy: SORT,
          include: EMPLOYEE_FIELDS,
          take,
        }) as unknown as ContractRow[],
    );
    return this.paginate(rows, params, fingerprint, contractSummary);
  }

  async createContract(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly employeeId: string;
      readonly contractNumber: string;
      readonly contractType: string;
      readonly startDate: string;
      readonly endDate: string | null;
      readonly status: string;
      readonly signedDate: string | null;
      readonly notes: string | null;
    },
  ): Promise<EmploymentContractSummary> {
    return this.write(companyId, principal, 'employment.contract_created', async (tx) => {
      await this.assertEmployee(tx, companyId, input.employeeId);
      const clash = await tx.employmentContract.findFirst({
        where: {
          companyId,
          contractNumber: input.contractNumber,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (clash !== null) {
        throw new ValidationError(
          `A contract with number ${input.contractNumber} already exists in this company.`,
        );
      }
      const row = (await tx.employmentContract.create({
        data: {
          companyId,
          employeeId: input.employeeId,
          contractNumber: input.contractNumber,
          contractType: input.contractType,
          startDate: new Date(input.startDate),
          endDate: input.endDate === null ? null : new Date(input.endDate),
          status: input.status,
          signedDate: input.signedDate === null ? null : new Date(input.signedDate),
          notes: input.notes,
          createdBy: principal.user.id,
        },
        include: EMPLOYEE_FIELDS,
      })) as unknown as ContractRow;
      return contractSummary(row);
    });
  }

  async updateContract(
    companyId: string,
    principal: SessionPrincipal,
    id: string,
    input: {
      readonly contractNumber?: string;
      readonly contractType?: string;
      readonly startDate?: string;
      readonly endDate?: string | null;
      readonly status?: string;
      readonly signedDate?: string | null;
      readonly notes?: string | null;
    },
  ): Promise<EmploymentContractSummary> {
    return this.write(companyId, principal, 'employment.contract_updated', async (tx) => {
      await this.assertContractExists(tx, companyId, id);
      if (input.contractNumber !== undefined) {
        const clash = await tx.employmentContract.findFirst({
          where: { companyId, contractNumber: input.contractNumber, deletedAt: null },
          select: { id: true },
        });
        if (clash !== null && clash.id !== id) {
          throw new ValidationError(
            `A contract with number ${input.contractNumber} already exists in this company.`,
          );
        }
      }
      const row = (await tx.employmentContract.update({
        where: { id },
        data: {
          ...(input.contractNumber === undefined ? {} : { contractNumber: input.contractNumber }),
          ...(input.contractType === undefined ? {} : { contractType: input.contractType }),
          ...(input.startDate === undefined ? {} : { startDate: new Date(input.startDate) }),
          ...(input.endDate === undefined
            ? {}
            : { endDate: input.endDate === null ? null : new Date(input.endDate) }),
          ...(input.status === undefined ? {} : { status: input.status }),
          ...(input.signedDate === undefined
            ? {}
            : { signedDate: input.signedDate === null ? null : new Date(input.signedDate) }),
          ...(input.notes === undefined ? {} : { notes: input.notes }),
        },
        include: EMPLOYEE_FIELDS,
      })) as unknown as ContractRow;
      return contractSummary(row);
    });
  }

  async removeContract(companyId: string, principal: SessionPrincipal, id: string): Promise<void> {
    await this.write(companyId, principal, 'employment.contract_deleted', async (tx) => {
      await this.assertContractExists(tx, companyId, id);
      await tx.employmentContract.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  // ---------------------------------------------------------------------------
  // Movements
  // ---------------------------------------------------------------------------

  async listMovements(
    companyId: string,
    principal: SessionPrincipal,
    filter: EmploymentQuery,
    params: PageParams,
  ): Promise<Paginated<EmployeeMovementSummary>> {
    const { where, fingerprint, take } = await this.listArgs(companyId, principal, filter, params);
    const client = this.prisma.getClient();
    const rows = await withTenantContext(
      client,
      companyId,
      async (tx) =>
        tx.employeeMovement.findMany({
          where,
          orderBy: SORT,
          include: EMPLOYEE_FIELDS,
          take,
        }) as unknown as MovementRow[],
    );
    return this.paginate(rows, params, fingerprint, movementSummary);
  }

  async createMovement(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly employeeId: string;
      readonly movementType: string;
      readonly effectiveDate: string;
      readonly fromUnitName: string | null;
      readonly toUnitName: string | null;
      readonly fromPositionName: string | null;
      readonly toPositionName: string | null;
      readonly reason: string | null;
    },
  ): Promise<EmployeeMovementSummary> {
    return this.write(companyId, principal, 'employment.movement_created', async (tx) => {
      await this.assertEmployee(tx, companyId, input.employeeId);
      const row = (await tx.employeeMovement.create({
        data: {
          companyId,
          employeeId: input.employeeId,
          movementType: input.movementType,
          effectiveDate: new Date(input.effectiveDate),
          fromUnitName: input.fromUnitName,
          toUnitName: input.toUnitName,
          fromPositionName: input.fromPositionName,
          toPositionName: input.toPositionName,
          reason: input.reason,
          createdBy: principal.user.id,
        },
        include: EMPLOYEE_FIELDS,
      })) as unknown as MovementRow;
      if (input.toUnitName !== null || input.toPositionName !== null) {
        const unitId =
          input.toUnitName === null
            ? undefined
            : await this.unitIdByName(tx, companyId, input.toUnitName);
        const positionId =
          input.toPositionName === null
            ? undefined
            : await this.positionIdByName(tx, companyId, input.toPositionName);
        await tx.employee.update({
          where: { id: input.employeeId },
          data: {
            ...(unitId === undefined ? {} : { organizationalUnit: unitId }),
            ...(positionId === undefined ? {} : { position: positionId }),
          },
        });
      }
      return movementSummary(row);
    });
  }

  async updateMovement(
    companyId: string,
    principal: SessionPrincipal,
    id: string,
    input: {
      readonly movementType?: string;
      readonly effectiveDate?: string;
      readonly fromUnitName?: string | null;
      readonly toUnitName?: string | null;
      readonly fromPositionName?: string | null;
      readonly toPositionName?: string | null;
      readonly reason?: string | null;
    },
  ): Promise<EmployeeMovementSummary> {
    return this.write(companyId, principal, 'employment.movement_updated', async (tx) => {
      await this.assertMovementExists(tx, companyId, id);
      const row = (await tx.employeeMovement.update({
        where: { id },
        data: {
          ...(input.movementType === undefined ? {} : { movementType: input.movementType }),
          ...(input.effectiveDate === undefined
            ? {}
            : { effectiveDate: new Date(input.effectiveDate) }),
          ...(input.fromUnitName === undefined ? {} : { fromUnitName: input.fromUnitName }),
          ...(input.toUnitName === undefined ? {} : { toUnitName: input.toUnitName }),
          ...(input.fromPositionName === undefined
            ? {}
            : { fromPositionName: input.fromPositionName }),
          ...(input.toPositionName === undefined ? {} : { toPositionName: input.toPositionName }),
          ...(input.reason === undefined ? {} : { reason: input.reason }),
        },
        include: EMPLOYEE_FIELDS,
      })) as unknown as MovementRow;
      return movementSummary(row);
    });
  }

  async removeMovement(companyId: string, principal: SessionPrincipal, id: string): Promise<void> {
    await this.write(companyId, principal, 'employment.movement_deleted', async (tx) => {
      await this.assertMovementExists(tx, companyId, id);
      await tx.employeeMovement.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  // ---------------------------------------------------------------------------
  // Shared internals
  // ---------------------------------------------------------------------------

  private async listArgs(
    companyId: string,
    principal: SessionPrincipal,
    filter: EmploymentQuery,
    params: PageParams,
  ): Promise<{
    readonly where: Record<string, unknown>;
    readonly take: number;
    readonly fingerprint: string;
  }> {
    const decision = this.readScope(principal);
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: { createdAt: 'desc', id: 'desc' } as const,
    });
    const resolution = resolveCursor(params.cursor, fingerprint);
    if (!resolution.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }
    const values = resolution.cursor.position.values;
    const after: Record<string, unknown> =
      values.length > 0
        ? {
            OR: [
              { createdAt: { lt: new Date(values[0] ?? '') } },
              { createdAt: new Date(values[0] ?? ''), id: { lt: values[1] ?? '' } },
            ],
          }
        : {};

    const client = this.prisma.getClient();
    const scope = await withTenantContext(client, companyId, (tx) =>
      this.readScopeWhere(tx, decision, principal.user.id),
    );
    const search = filter.search?.trim() ?? '';
    return {
      where: {
        companyId,
        deletedAt: null,
        ...scope,
        ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
        ...(filter.type ? { type: filter.type } : {}),
        ...(search
          ? {
              OR: [
                {
                  employee: {
                    user: { displayName: { contains: search, mode: 'insensitive' as const } },
                  },
                },
                {
                  employee: { employeeNumber: { contains: search, mode: 'insensitive' as const } },
                },
              ],
            }
          : {}),
        ...after,
      },
      take: params.limit + 1,
      fingerprint,
    };
  }

  private async readScopeWhere(
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

  private paginate<T>(
    rows: readonly { readonly createdAt: Date; readonly id: string }[],
    params: PageParams,
    fingerprint: string,
    map: (row: unknown) => T,
  ): Paginated<T> {
    const items = rows.map((row) => map(row));
    return buildPage(items, params, fingerprint, (item) => ({
      values: [
        (item as { readonly createdAt: string }).createdAt,
        (item as { readonly id: string }).id,
      ],
    }));
  }

  private async write<T>(
    companyId: string,
    principal: SessionPrincipal,
    action: string,
    run: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    this.assertWritableScope(principal);
    const client = this.prisma.getClient();
    const result = await withTenantContext(client, companyId, run);
    await this.audit(companyId, principal.user.id, action, principal.user.id);
    return result;
  }

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

  private assertWritableScope(principal: SessionPrincipal): void {
    const decision = this.readScope(principal);
    if (decision.kind !== 'all') {
      throw new OutOfScopeError('Editing employment records requires company-wide data scope.');
    }
  }

  private async assertEmployee(
    tx: Prisma.TransactionClient,
    companyId: string,
    employeeId: string,
  ): Promise<void> {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (employee === null) {
      throw new NotFoundError('The employee does not exist.');
    }
  }

  private async assertContractExists(
    tx: Prisma.TransactionClient,
    companyId: string,
    id: string,
  ): Promise<void> {
    const row = await tx.employmentContract.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });
    if (row === null) {
      throw new NotFoundError('The contract does not exist.');
    }
  }

  private async assertMovementExists(
    tx: Prisma.TransactionClient,
    companyId: string,
    id: string,
  ): Promise<void> {
    const row = await tx.employeeMovement.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });
    if (row === null) {
      throw new NotFoundError('The movement does not exist.');
    }
  }

  private async unitIdByName(
    tx: Prisma.TransactionClient,
    companyId: string,
    name: string,
  ): Promise<string> {
    const unit = await tx.organizationalUnit.findFirst({
      where: { companyId, name, deletedAt: null },
      select: { id: true },
    });
    if (unit === null) {
      throw new ValidationError(`No organizational unit named "${name}" exists in this company.`);
    }
    return unit.id;
  }

  private async positionIdByName(
    tx: Prisma.TransactionClient,
    companyId: string,
    name: string,
  ): Promise<string> {
    const position = await tx.position.findFirst({
      where: { companyId, name, deletedAt: null },
      select: { id: true },
    });
    if (position === null) {
      throw new ValidationError(`No position named "${name}" exists in this company.`);
    }
    return position.id;
  }

  private async audit(
    companyId: string,
    actorUserId: string,
    action: string,
    resourceId: string,
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
    });
  }
}

function contractSummary(row: unknown): EmploymentContractSummary {
  const r = row as ContractRow;
  return {
    employeeId: r.employee.id,
    employeeName: r.employee.user.displayName,
    employeeNumber: r.employee.employeeNumber,
    id: r.id,
    contractNumber: r.contractNumber,
    contractType: r.contractType,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate?.toISOString() ?? null,
    status: r.status,
    signedDate: r.signedDate?.toISOString() ?? null,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function movementSummary(row: unknown): EmployeeMovementSummary {
  const r = row as MovementRow;
  return {
    employeeId: r.employee.id,
    employeeName: r.employee.user.displayName,
    employeeNumber: r.employee.employeeNumber,
    id: r.id,
    movementType: r.movementType,
    effectiveDate: r.effectiveDate.toISOString(),
    fromUnitName: r.fromUnitName,
    toUnitName: r.toUnitName,
    fromPositionName: r.fromPositionName,
    toPositionName: r.toPositionName,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
