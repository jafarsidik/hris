import {
  buildPage,
  cursorFingerprint,
  normalisePageParams,
  resolveCursor,
} from '@hris/shared-types';

import type {
  LeaveRequest,
  LeaveRequestPage,
  LeaveRequestQuery,
  LeaveRepository,
  CreateLeaveRequestInput,
} from './leave-types';

/**
 * An in-memory leave request repository used before the leave endpoint exists.
 *
 * Deterministic and keyset-paginated, mirroring the real API contract so the
 * screens can be built and reviewed now.
 */
const LEAVE_REQUESTS: readonly LeaveRequest[] = Object.freeze([
  {
    id: 'leave-0001',
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    leaveTypeId: 'leave-type-0001',
    leaveTypeName: 'Annual Leave',
    startDate: '2026-11-02T00:00:00Z',
    endDate: '2026-11-06T00:00:00Z',
    days: 5,
    reason: 'Family vacation',
    status: 'APPROVED',
    approverId: 'emp-0010',
    approvedAt: '2026-10-20T00:00:00Z',
    createdAt: '2026-10-15T00:00:00Z',
    updatedAt: '2026-10-20T00:00:00Z',
  },
  {
    id: 'leave-0002',
    employeeId: 'emp-0002',
    employeeName: 'Adeyemi Bergman',
    employeeNumber: 'EMP-0002',
    leaveTypeId: 'leave-type-0002',
    leaveTypeName: 'Sick Leave',
    startDate: '2026-11-10T00:00:00Z',
    endDate: '2026-11-10T00:00:00Z',
    days: 1,
    reason: 'Medical appointment',
    status: 'PENDING',
    approverId: null,
    approvedAt: null,
    createdAt: '2026-10-18T00:00:00Z',
    updatedAt: '2026-10-18T00:00:00Z',
  },
  {
    id: 'leave-0003',
    employeeId: 'emp-0003',
    employeeName: 'Castillo Dubois',
    employeeNumber: 'EMP-0003',
    leaveTypeId: 'leave-type-0001',
    leaveTypeName: 'Annual Leave',
    startDate: '2026-12-01T00:00:00Z',
    endDate: '2026-12-15T00:00:00Z',
    days: 15,
    reason: 'Year-end break',
    status: 'PENDING',
    approverId: null,
    approvedAt: null,
    createdAt: '2026-10-17T00:00:00Z',
    updatedAt: '2026-10-17T00:00:00Z',
  },
] as const);

class MockLeaveRepository implements LeaveRepository {
  async listRequests(query: LeaveRequestQuery): Promise<LeaveRequestPage> {
    const params = normalisePageParams(query.page ?? {});
    const filters = {
      employeeId: query.employeeId ?? '',
      leaveTypeId: query.leaveTypeId ?? '',
      status: query.status ?? '',
      search: query.search?.trim() ?? '',
    };
    const fingerprint = cursorFingerprint({ filters, sort: { createdAt: 'desc', id: 'desc' } });
    const resolution = resolveCursor(query.page?.cursor, fingerprint);
    if (!resolution.ok) {
      throw new Error('The pagination cursor does not match the current filters');
    }

    let ordered = [...LEAVE_REQUESTS];
    if (filters.employeeId) ordered = ordered.filter((r) => r.employeeId === filters.employeeId);
    if (filters.leaveTypeId) ordered = ordered.filter((r) => r.leaveTypeId === filters.leaveTypeId);
    if (filters.status) ordered = ordered.filter((r) => r.status === filters.status);
    if (filters.search) {
      const needle = filters.search.toLowerCase();
      ordered = ordered.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(needle) ||
          r.employeeNumber.toLowerCase().includes(needle) ||
          (r.reason ?? '').toLowerCase().includes(needle) ||
          r.leaveTypeName.toLowerCase().includes(needle),
      );
    }

    const anchor =
      resolution.cursor.position.values.length > 0
        ? ordered.find((r) => r.id === resolution.cursor.position.values[1])
        : undefined;
    const afterAnchor = anchor === undefined ? ordered : ordered.slice(ordered.indexOf(anchor) + 1);
    const window = afterAnchor.slice(0, params.limit + 1);

    return buildPage(window, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async getRequest(id: string): Promise<LeaveRequest | null> {
    return LEAVE_REQUESTS.find((r) => r.id === id) ?? null;
  }

  async createRequest(_input: CreateLeaveRequestInput): Promise<LeaveRequest> {
    throw new Error('Create not supported by mock in this build');
  }

  async updateRequest(
    _id: string,
    _input: Partial<CreateLeaveRequestInput> & { readonly status?: string },
  ): Promise<LeaveRequest> {
    throw new Error('Update not supported by mock in this build');
  }

  async deleteRequest(_id: string): Promise<void> {
    throw new Error('Delete not supported by mock in this build');
  }
}

export const mockLeaveRepository: LeaveRepository = new MockLeaveRepository();
