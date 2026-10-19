import {
  buildPage,
  cursorFingerprint,
  normalisePageParams,
  resolveCursor,
} from '@hris/shared-types';

import type {
  PayrollPeriod,
  PayrollPeriodPage,
  PayrollRepository,
  PayrollRun,
  PayrollRunPage,
  PayrollRunQuery,
  SalaryStructure,
  SalaryStructurePage,
} from './payroll-types';

const PERIODS: readonly PayrollPeriod[] = Object.freeze([
  {
    id: 'prd-2026-10',
    code: '2026-10',
    name: 'October 2026',
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2026-10-31T00:00:00Z',
    payDate: '2026-11-05T00:00:00Z',
    status: 'OPEN',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'prd-2026-09',
    code: '2026-09',
    name: 'September 2026',
    startDate: '2026-09-01T00:00:00Z',
    endDate: '2026-09-30T00:00:00Z',
    payDate: '2026-10-05T00:00:00Z',
    status: 'PAID',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-10-05T00:00:00Z',
  },
] as const);

const RUNS: readonly PayrollRun[] = Object.freeze([
  {
    id: 'run-0001',
    periodId: 'prd-2026-10',
    periodCode: '2026-10',
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    baseSalary: 8_500_000,
    totalEarnings: 9_200_000,
    totalDeductions: 900_000,
    netPay: 8_300_000,
    status: 'DRAFT',
    paidAt: null,
    createdAt: '2026-10-18T02:00:00Z',
    updatedAt: '2026-10-18T02:00:00Z',
  },
  {
    id: 'run-0002',
    periodId: 'prd-2026-10',
    periodCode: '2026-10',
    employeeId: 'emp-0002',
    employeeName: 'Adeyemi Bergman',
    employeeNumber: 'EMP-0002',
    baseSalary: 7_000_000,
    totalEarnings: 7_400_000,
    totalDeductions: 770_000,
    netPay: 6_630_000,
    status: 'APPROVED',
    paidAt: null,
    createdAt: '2026-10-18T02:05:00Z',
    updatedAt: '2026-10-18T03:00:00Z',
  },
  {
    id: 'run-0003',
    periodId: 'prd-2026-09',
    periodCode: '2026-09',
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    baseSalary: 8_500_000,
    totalEarnings: 8_500_000,
    totalDeductions: 850_000,
    netPay: 7_650_000,
    status: 'PAID',
    paidAt: '2026-10-05T04:00:00Z',
    createdAt: '2026-09-28T02:00:00Z',
    updatedAt: '2026-10-05T04:00:00Z',
  },
] as const);

const SALARY_STRUCTURES: readonly SalaryStructure[] = Object.freeze([
  {
    id: 'sal-0001',
    positionId: 'pos-0001',
    positionTitle: 'Software Engineer',
    baseSalary: 8_500_000,
    currency: 'IDR',
    effectiveFrom: '2026-01-01T00:00:00Z',
    effectiveTo: null,
    isActive: true,
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
  {
    id: 'sal-0002',
    positionId: 'pos-0002',
    positionTitle: 'People Operations Lead',
    baseSalary: 12_000_000,
    currency: 'IDR',
    effectiveFrom: '2026-01-01T00:00:00Z',
    effectiveTo: null,
    isActive: true,
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
] as const);

class MockPayrollRepository implements PayrollRepository {
  async listPeriods(query: { readonly search?: string }): Promise<PayrollPeriodPage> {
    const params = normalisePageParams({});
    const filters = { search: query.search?.trim() ?? '' };
    const fingerprint = cursorFingerprint({ filters, sort: PERIOD_SORT });
    const resolution = resolveCursor(undefined, fingerprint);
    if (!resolution.ok) {
      throw new Error('The pagination cursor does not match the current filters');
    }
    let ordered = [...PERIODS];
    if (filters.search) {
      const needle = filters.search.toLowerCase();
      ordered = ordered.filter(
        (p) => p.name.toLowerCase().includes(needle) || p.code.toLowerCase().includes(needle),
      );
    }
    return buildPage(ordered, params, fingerprint, (item) => ({
      values: [item.startDate, item.id],
    }));
  }

  async listRuns(query: PayrollRunQuery): Promise<PayrollRunPage> {
    const params = normalisePageParams({});
    const filters = {
      periodId: query.periodId ?? '',
      employeeId: query.employeeId ?? '',
      status: query.status ?? '',
      search: query.search?.trim() ?? '',
    };
    const fingerprint = cursorFingerprint({ filters, sort: RUN_SORT });
    const resolution = resolveCursor(undefined, fingerprint);
    if (!resolution.ok) {
      throw new Error('The pagination cursor does not match the current filters');
    }
    let ordered = [...RUNS];
    if (filters.periodId) ordered = ordered.filter((r) => r.periodId === filters.periodId);
    if (filters.employeeId) ordered = ordered.filter((r) => r.employeeId === filters.employeeId);
    if (filters.status) ordered = ordered.filter((r) => r.status === filters.status);
    if (filters.search) {
      const needle = filters.search.toLowerCase();
      ordered = ordered.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(needle) ||
          r.employeeNumber.toLowerCase().includes(needle),
      );
    }
    return buildPage(ordered, params, fingerprint, (item) => ({
      values: [item.createdAt, item.id],
    }));
  }

  async listSalaryStructures(): Promise<SalaryStructurePage> {
    const params = normalisePageParams({});
    const fingerprint = cursorFingerprint({ filters: {}, sort: SALARY_SORT });
    const resolution = resolveCursor(undefined, fingerprint);
    if (!resolution.ok) {
      throw new Error('The pagination cursor does not match the current filters');
    }
    return buildPage([...SALARY_STRUCTURES], params, fingerprint, (item) => ({
      values: [item.effectiveFrom, item.id],
    }));
  }
}

const PERIOD_SORT = { startDate: 'desc', id: 'desc' } as const;
const RUN_SORT = { createdAt: 'desc', id: 'desc' } as const;
const SALARY_SORT = { effectiveFrom: 'desc', id: 'desc' } as const;

export const mockPayrollRepository: PayrollRepository = new MockPayrollRepository();
