import {
  buildPage,
  cursorFingerprint,
  normalisePageParams,
  resolveCursor,
} from '@hris/shared-types';

import type { OffboardingCase, OffboardingCasePage } from './offboarding-types';

const CASES: readonly OffboardingCase[] = Object.freeze([
  {
    id: 'off-0001',
    employeeId: 'emp-0004',
    employeeName: 'Castillo Dubois',
    employeeNumber: 'EMP-0004',
    reason: 'Resignation — accepted another offer.',
    lastWorkingDate: '2026-11-13T00:00:00Z',
    status: 'IN_CLEARANCE',
    exitInterviewNotes: null,
    checklistTotal: 5,
    checklistDone: 3,
    createdAt: '2026-10-10T00:00:00Z',
    updatedAt: '2026-10-17T00:00:00Z',
  },
  {
    id: 'off-0002',
    employeeId: 'emp-0005',
    employeeName: 'Imani Okafor',
    employeeNumber: 'EMP-0005',
    reason: 'Contract ended.',
    lastWorkingDate: '2026-09-30T00:00:00Z',
    status: 'COMPLETED',
    exitInterviewNotes: 'Positive exit; possible boomerang hire.',
    checklistTotal: 5,
    checklistDone: 5,
    createdAt: '2026-09-15T00:00:00Z',
    updatedAt: '2026-09-30T00:00:00Z',
  },
] as const);

const SORT = { createdAt: 'desc', id: 'desc' } as const;

class MockOffboardingRepository {
  async listCases(query: {
    readonly status?: string;
    readonly search?: string;
  }): Promise<OffboardingCasePage> {
    const params = normalisePageParams({});
    const filters = { status: query.status ?? '', search: query.search?.trim() ?? '' };
    const fingerprint = cursorFingerprint({ filters, sort: SORT });
    const resolution = resolveCursor(undefined, fingerprint);
    if (!resolution.ok) {
      throw new Error('The pagination cursor does not match the current filters');
    }
    let rows = [...CASES];
    if (filters.status) rows = rows.filter((c) => c.status === filters.status);
    if (filters.search) {
      const needle = filters.search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.reason.toLowerCase().includes(needle) ||
          c.employeeName.toLowerCase().includes(needle) ||
          c.employeeNumber.toLowerCase().includes(needle),
      );
    }
    return buildPage(rows, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }
}

export const mockOffboardingRepository = new MockOffboardingRepository();
