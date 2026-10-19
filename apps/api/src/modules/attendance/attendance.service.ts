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
  type AttendanceRecordQuery,
  type AttendanceRecordSummary,
  type PageParams,
  type Paginated,
  type ShiftPatternQuery,
  type ShiftPatternSummary,
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

const ATTENDANCE_SORT = { attendanceDate: 'desc', id: 'desc' } as const;
const SHIFT_PATTERN_SORT = { createdAt: 'asc', id: 'asc' } as const;

interface AttendanceRecordRow {
  readonly id: string;
  readonly employeeId: string;
  readonly attendanceDate: Date;
  readonly clockIn: Date | null;
  readonly clockOut: Date | null;
  readonly breakMinutes: number;
  readonly status: string;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
  readonly employee: {
    readonly id: string;
    readonly employeeNumber: string;
    readonly user: { readonly displayName: string };
  };
}

interface ShiftPatternRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly breakMinutes: number;
  readonly workDays: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly deletedAt: Date | null;
}

/**
 * Attendance & Time: daily employee attendance records and reusable shift
 * patterns.
 *
 * Every read and mutation runs inside `withTenantContext`. Reads narrow to the
 * caller's `attendance:view` data scope (`all`/`self`/`subtree`/`entity`).
 */
@Injectable()
export class AttendanceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  // ---------------------------------------------------------------------------
  // Attendance records
  // ---------------------------------------------------------------------------

  async listAttendanceRecords(
    companyId: string,
    principal: SessionPrincipal,
    filter: AttendanceRecordQuery,
    params: PageParams,
  ): Promise<Paginated<AttendanceRecordSummary>> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: ATTENDANCE_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await attendanceRecordScopeWhere(tx, decision, principal.user.id);
      return tx.attendanceRecord.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...scopeWhere,
          ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.fromDate ? { attendanceDate: { gte: new Date(filter.fromDate) } } : {}),
          ...(filter.toDate ? { attendanceDate: { lte: new Date(filter.toDate) } } : {}),
          ...(filter.search ? { OR: attendanceRecordSearchWhere(filter.search) } : {}),
          ...(resolved.cursor.position.values.length > 0
            ? afterAttendanceRecordCursor(resolved.cursor.position.values)
            : {}),
        },
        orderBy: [{ attendanceDate: 'desc' }, { id: 'desc' }],
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { displayName: true } },
            },
          },
        },
        take: params.limit + 1,
      }) as unknown as AttendanceRecordRow[];
    });

    const items = rows.map(toAttendanceRecordSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.attendanceDate, item.id],
    }));
  }

  async getAttendanceRecord(
    companyId: string,
    principal: SessionPrincipal,
    attendanceRecordId: string,
  ): Promise<AttendanceRecordSummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await attendanceRecordScopeWhere(tx, decision, principal.user.id);
      return tx.attendanceRecord.findFirst({
        where: { id: attendanceRecordId, companyId, deletedAt: null, ...scopeWhere },
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { displayName: true } },
            },
          },
        },
      }) as unknown as AttendanceRecordRow | null;
    });
    if (row === null) {
      throw new NotFoundError('The attendance record does not exist.');
    }
    return toAttendanceRecordSummary(row);
  }

  async createAttendanceRecord(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly employeeId: string;
      readonly attendanceDate: string;
      readonly clockIn: string | null;
      readonly clockOut: string | null;
      readonly breakMinutes?: number;
      readonly status?: string;
      readonly notes?: string | null;
    },
  ): Promise<AttendanceRecordSummary> {
    const decision = this.readScope(principal);
    if (decision.kind !== 'all' && decision.kind !== 'self') {
      throw new OutOfScopeError('Your scope does not allow creating attendance records.');
    }
    if (decision.kind === 'self' && input.employeeId !== principal.user.id) {
      throw new OutOfScopeError('You may only create attendance records for yourself.');
    }

    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const existing = await tx.attendanceRecord.findFirst({
        where: {
          companyId,
          employeeId: input.employeeId,
          attendanceDate: new Date(input.attendanceDate),
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existing !== null) {
        throw new ConflictError(
          'An attendance record already exists for this employee on this date.',
        );
      }
      return tx.attendanceRecord.create({
        data: {
          companyId,
          employeeId: input.employeeId,
          attendanceDate: new Date(input.attendanceDate),
          clockIn: input.clockIn === null ? null : new Date(input.clockIn),
          clockOut: input.clockOut === null ? null : new Date(input.clockOut),
          breakMinutes: input.breakMinutes ?? 0,
          status: input.status ?? 'PRESENT',
          notes: input.notes,
          createdBy: principal.user.id,
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { displayName: true } },
            },
          },
        },
      }) as unknown as AttendanceRecordRow;
    });

    await this.audit(companyId, principal.user.id, 'attendance.record_created', row.id, {
      employeeId: input.employeeId,
      attendanceDate: input.attendanceDate,
    });
    return toAttendanceRecordSummary(row);
  }

  async updateAttendanceRecord(
    companyId: string,
    principal: SessionPrincipal,
    attendanceRecordId: string,
    input: {
      readonly clockIn?: string | null;
      readonly clockOut?: string | null;
      readonly breakMinutes?: number;
      readonly status?: string;
      readonly notes?: string | null;
    },
  ): Promise<AttendanceRecordSummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await attendanceRecordScopeWhere(tx, decision, principal.user.id);
      const current = await tx.attendanceRecord.findFirst({
        where: { id: attendanceRecordId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The attendance record does not exist.');
      }
      return tx.attendanceRecord.update({
        where: { id: attendanceRecordId },
        data: {
          ...(input.clockIn === undefined
            ? {}
            : { clockIn: input.clockIn === null ? null : new Date(input.clockIn) }),
          ...(input.clockOut === undefined
            ? {}
            : { clockOut: input.clockOut === null ? null : new Date(input.clockOut) }),
          ...(input.breakMinutes === undefined ? {} : { breakMinutes: input.breakMinutes }),
          ...(input.status === undefined ? {} : { status: input.status }),
          ...(input.notes === undefined ? {} : { notes: input.notes }),
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { displayName: true } },
            },
          },
        },
      }) as unknown as AttendanceRecordRow;
    });

    await this.audit(companyId, principal.user.id, 'attendance.record_updated', attendanceRecordId);
    return toAttendanceRecordSummary(row);
  }

  async deleteAttendanceRecord(
    companyId: string,
    principal: SessionPrincipal,
    attendanceRecordId: string,
  ): Promise<void> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();

    await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await attendanceRecordScopeWhere(tx, decision, principal.user.id);
      const current = await tx.attendanceRecord.findFirst({
        where: { id: attendanceRecordId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The attendance record does not exist.');
      }
      await tx.attendanceRecord.update({
        where: { id: attendanceRecordId },
        data: { deletedAt: new Date() },
      });
    });

    await this.audit(companyId, principal.user.id, 'attendance.record_deleted', attendanceRecordId);
  }

  // ---------------------------------------------------------------------------
  // Shift patterns
  // ---------------------------------------------------------------------------

  async listShiftPatterns(
    companyId: string,
    principal: SessionPrincipal,
    filter: ShiftPatternQuery,
    params: PageParams,
  ): Promise<Paginated<ShiftPatternSummary>> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const fingerprint = cursorFingerprint({
      filters: { ...filter, companyId },
      sort: SHIFT_PATTERN_SORT,
    });
    const resolved = resolveCursor(params.cursor, fingerprint);
    if (!resolved.ok) {
      throw new ValidationError('The pagination cursor does not match the current filters');
    }

    const rows = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await shiftPatternScopeWhere(tx, decision);
      return tx.shiftPattern.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...scopeWhere,
          ...(filter.search ? { OR: shiftPatternSearchWhere(filter.search) } : {}),
          ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
          ...(resolved.cursor.position.values.length > 0
            ? afterShiftPatternCursor(resolved.cursor.position.values)
            : {}),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: params.limit + 1,
      }) as unknown as ShiftPatternRow[];
    });

    const items = rows.map(toShiftPatternSummary);
    return buildPage(items, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async getShiftPattern(
    companyId: string,
    principal: SessionPrincipal,
    shiftPatternId: string,
  ): Promise<ShiftPatternSummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await shiftPatternScopeWhere(tx, decision);
      return tx.shiftPattern.findFirst({
        where: { id: shiftPatternId, companyId, deletedAt: null, ...scopeWhere },
      }) as unknown as ShiftPatternRow | null;
    });
    if (row === null) {
      throw new NotFoundError('The shift pattern does not exist.');
    }
    return toShiftPatternSummary(row);
  }

  async createShiftPattern(
    companyId: string,
    principal: SessionPrincipal,
    input: {
      readonly code: string;
      readonly name: string;
      readonly description: string | null;
      readonly startTime: string;
      readonly endTime: string;
      readonly breakMinutes: number;
      readonly workDays: string;
      readonly isActive: boolean;
    },
  ): Promise<ShiftPatternSummary> {
    const decision = this.readScope(principal);
    if (decision.kind !== 'all') {
      throw new OutOfScopeError('Your scope does not allow creating shift patterns.');
    }

    const client = this.prisma.getClient();
    const code = input.code.trim();
    const row = await withTenantContext(client, companyId, async (tx) => {
      await this.assertShiftPatternCodeFree(tx, companyId, code, null);
      return tx.shiftPattern.create({
        data: {
          companyId,
          code,
          name: input.name.trim(),
          description: input.description,
          startTime: new Date(input.startTime),
          endTime: new Date(input.endTime),
          breakMinutes: input.breakMinutes,
          workDays: input.workDays,
          isActive: input.isActive,
          createdBy: principal.user.id,
        },
      }) as unknown as ShiftPatternRow;
    });

    await this.audit(companyId, principal.user.id, 'shift.pattern_created', row.id, {
      code,
      name: row.name,
    });
    return toShiftPatternSummary(row);
  }

  async updateShiftPattern(
    companyId: string,
    principal: SessionPrincipal,
    shiftPatternId: string,
    input: {
      readonly name?: string;
      readonly description?: string | null;
      readonly startTime?: string;
      readonly endTime?: string;
      readonly breakMinutes?: number;
      readonly workDays?: string;
      readonly isActive?: boolean;
    },
  ): Promise<ShiftPatternSummary> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();

    const row = await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await shiftPatternScopeWhere(tx, decision);
      const current = await tx.shiftPattern.findFirst({
        where: { id: shiftPatternId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The shift pattern does not exist.');
      }
      return tx.shiftPattern.update({
        where: { id: shiftPatternId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.startTime === undefined ? {} : { startTime: new Date(input.startTime) }),
          ...(input.endTime === undefined ? {} : { endTime: new Date(input.endTime) }),
          ...(input.breakMinutes === undefined ? {} : { breakMinutes: input.breakMinutes }),
          ...(input.workDays === undefined ? {} : { workDays: input.workDays }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
      }) as unknown as ShiftPatternRow;
    });

    await this.audit(companyId, principal.user.id, 'shift.pattern_updated', shiftPatternId);
    return toShiftPatternSummary(row);
  }

  async deleteShiftPattern(
    companyId: string,
    principal: SessionPrincipal,
    shiftPatternId: string,
  ): Promise<void> {
    const decision = this.readScope(principal);
    const client = this.prisma.getClient();

    await withTenantContext(client, companyId, async (tx) => {
      const scopeWhere = await shiftPatternScopeWhere(tx, decision);
      const current = await tx.shiftPattern.findFirst({
        where: { id: shiftPatternId, companyId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (current === null) {
        throw new NotFoundError('The shift pattern does not exist.');
      }
      await tx.shiftPattern.update({
        where: { id: shiftPatternId },
        data: { deletedAt: new Date() },
      });
    });

    await this.audit(companyId, principal.user.id, 'shift.pattern_deleted', shiftPatternId);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private readScope(principal: SessionPrincipal): ScopeDecision {
    const decision = resolveScope(principal.permissions, 'attendance', 'view', {
      userId: principal.user.id,
      unitId: principal.user.organizationalUnitId,
    });
    if (decision.kind === 'denied') {
      throw new OutOfScopeError(
        `Your "${decision.scope ?? 'unresolved'}" scope for attendance.view cannot be resolved.`,
      );
    }
    return decision;
  }

  private async assertShiftPatternCodeFree(
    tx: Prisma.TransactionClient,
    companyId: string,
    code: string,
    excludeId: string | null,
  ): Promise<void> {
    const clash = await tx.shiftPattern.findFirst({
      where: {
        companyId,
        code,
        deletedAt: null,
        ...(excludeId === null ? {} : { id: { not: excludeId } }),
      },
      select: { id: true },
    });
    if (clash !== null) {
      throw new ConflictError(`A shift pattern with the code "${code}" already exists.`);
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
      resource: 'attendance',
      resourceId,
      status: 'SUCCESS',
    });
    await this.logs.writeAudit(companyId, {
      actorUserId,
      action,
      resource: 'attendance',
      resourceId,
      ...(payload === undefined ? {} : { payload }),
    });
  }
}

async function attendanceRecordScopeWhere(
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

async function shiftPatternScopeWhere(
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

function attendanceRecordSearchWhere(search: string): Record<string, unknown>[] {
  const q = search.trim();
  if (q.length === 0) return [];
  return [
    { employee: { user: { displayName: { contains: q, mode: 'insensitive' } } } },
    { employee: { employeeNumber: { contains: q, mode: 'insensitive' } } },
    { notes: { contains: q, mode: 'insensitive' } },
  ];
}

function shiftPatternSearchWhere(search: string): Record<string, unknown>[] {
  const q = search.trim();
  if (q.length === 0) return [];
  return [
    { code: { contains: q, mode: 'insensitive' } },
    { name: { contains: q, mode: 'insensitive' } },
  ];
}

function afterAttendanceRecordCursor(values: readonly string[]): Record<string, unknown> {
  const attendanceDate = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ attendanceDate: { lt: attendanceDate } }, { attendanceDate, id: { lt: id } }] };
}

function afterShiftPatternCursor(values: readonly string[]): Record<string, unknown> {
  const createdAt = new Date(values[0] ?? '');
  const id = values[1] ?? '';
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] };
}

function toAttendanceRecordSummary(row: AttendanceRecordRow): AttendanceRecordSummary {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employee.user.displayName,
    employeeNumber: row.employee.employeeNumber,
    attendanceDate: row.attendanceDate.toISOString(),
    clockIn: row.clockIn?.toISOString() ?? null,
    clockOut: row.clockOut?.toISOString() ?? null,
    breakMinutes: row.breakMinutes,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toShiftPatternSummary(row: ShiftPatternRow): ShiftPatternSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    breakMinutes: row.breakMinutes,
    workDays: row.workDays,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
