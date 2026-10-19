import {
  buildPage,
  cursorFingerprint,
  normalisePageParams,
  resolveCursor,
} from '@hris/shared-types';

import type {
  AttendanceRecord,
  AttendanceRecordPage,
  AttendanceRecordQuery,
  AttendanceRepository,
} from './attendance-types';

const RECORDS: readonly AttendanceRecord[] = Object.freeze([
  {
    id: 'att-0001',
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    attendanceDate: '2026-10-18T00:00:00Z',
    clockIn: '2026-10-18T08:00:00Z',
    clockOut: '2026-10-18T17:00:00Z',
    breakMinutes: 60,
    status: 'PRESENT',
    notes: null,
    createdAt: '2026-10-18T17:05:00Z',
    updatedAt: '2026-10-18T17:05:00Z',
  },
  {
    id: 'att-0002',
    employeeId: 'emp-0002',
    employeeName: 'Adeyemi Bergman',
    employeeNumber: 'EMP-0002',
    attendanceDate: '2026-10-18T00:00:00Z',
    clockIn: '2026-10-18T08:15:00Z',
    clockOut: null,
    breakMinutes: 0,
    status: 'LATE',
    notes: 'Late arrival',
    createdAt: '2026-10-18T08:20:00Z',
    updatedAt: '2026-10-18T08:20:00Z',
  },
  {
    id: 'att-0003',
    employeeId: 'emp-0003',
    employeeName: 'Castillo Dubois',
    employeeNumber: 'EMP-0003',
    attendanceDate: '2026-10-17T00:00:00Z',
    clockIn: '2026-10-17T08:00:00Z',
    clockOut: '2026-10-17T17:00:00Z',
    breakMinutes: 60,
    status: 'PRESENT',
    notes: null,
    createdAt: '2026-10-17T17:05:00Z',
    updatedAt: '2026-10-17T17:05:00Z',
  },
] as const);

class MockAttendanceRepository implements AttendanceRepository {
  async listRecords(query: AttendanceRecordQuery): Promise<AttendanceRecordPage> {
    const params = normalisePageParams(query.page ?? {});
    const filters = {
      employeeId: query.employeeId ?? '',
      status: query.status ?? '',
      fromDate: query.fromDate ?? '',
      toDate: query.toDate ?? '',
      search: query.search?.trim() ?? '',
    };
    const fingerprint = cursorFingerprint({ filters, sort: ATTENDANCE_SORT });
    const resolution = resolveCursor(query.page?.cursor, fingerprint);
    if (!resolution.ok) {
      throw new Error('The pagination cursor does not match the current filters');
    }

    let ordered = [...RECORDS];
    if (filters.employeeId) ordered = ordered.filter((r) => r.employeeId === filters.employeeId);
    if (filters.status) ordered = ordered.filter((r) => r.status === filters.status);
    if (filters.fromDate) {
      ordered = ordered.filter((r) => r.attendanceDate >= filters.fromDate);
    }
    if (filters.toDate) {
      ordered = ordered.filter((r) => r.attendanceDate <= filters.toDate);
    }
    if (filters.search) {
      const needle = filters.search.toLowerCase();
      ordered = ordered.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(needle) ||
          r.employeeNumber.toLowerCase().includes(needle) ||
          (r.notes ?? '').toLowerCase().includes(needle),
      );
    }

    const anchor =
      resolution.cursor.position.values.length > 0
        ? ordered.find((r) => r.id === resolution.cursor.position.values[1])
        : undefined;
    const afterAnchor = anchor === undefined ? ordered : ordered.slice(ordered.indexOf(anchor) + 1);
    const window = afterAnchor.slice(0, params.limit + 1);

    return buildPage(window, params, fingerprint, (item) => ({
      values: [item.attendanceDate, item.id],
    }));
  }

  async getRecord(id: string): Promise<AttendanceRecord | null> {
    return RECORDS.find((r) => r.id === id) ?? null;
  }

  async createRecord(): Promise<AttendanceRecord> {
    throw new Error('Create not supported by mock in this build');
  }

  async updateRecord(): Promise<AttendanceRecord> {
    throw new Error('Update not supported by mock in this build');
  }

  async deleteRecord(): Promise<void> {
    throw new Error('Delete not supported by mock in this build');
  }
}

const ATTENDANCE_SORT = { attendanceDate: 'desc', id: 'desc' } as const;

export const mockAttendanceRepository: AttendanceRepository = new MockAttendanceRepository();
