import {
  buildPage,
  cursorFingerprint,
  normalisePageParams,
  resolveCursor,
  type EmployeeMovementSummary,
  type EmploymentContractSummary,
} from '@hris/shared-types';

const CONTRACTS: readonly EmploymentContractSummary[] = Object.freeze([
  {
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    id: 'con-0001',
    contractNumber: 'CT-2024-001',
    contractType: 'PERMANENT',
    startDate: '2024-01-02T00:00:00Z',
    endDate: null,
    status: 'ACTIVE',
    signedDate: '2023-12-18T00:00:00Z',
    notes: 'Signed after successful probation.',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    employeeId: 'emp-0002',
    employeeName: 'Adeyemi Bergman',
    employeeNumber: 'EMP-0002',
    id: 'con-0002',
    contractNumber: 'CT-2025-014',
    contractType: 'PROBATION',
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-07-01T00:00:00Z',
    status: 'ACTIVE',
    signedDate: '2025-12-20T00:00:00Z',
    notes: 'Six-month probation window.',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    employeeId: 'emp-0003',
    employeeName: 'Hana Suciati',
    employeeNumber: 'EMP-0003',
    id: 'con-0003',
    contractNumber: 'CT-2025-038',
    contractType: 'FIXED_TERM',
    startDate: '2025-07-01T00:00:00Z',
    endDate: '2026-06-30T00:00:00Z',
    status: 'ACTIVE',
    signedDate: '2025-06-22T00:00:00Z',
    notes: null,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    employeeId: 'emp-0004',
    employeeName: 'Marcus Webb',
    employeeNumber: 'EMP-0004',
    id: 'con-0004',
    contractNumber: 'CT-2025-051',
    contractType: 'INTERNSHIP',
    startDate: '2025-09-01T00:00:00Z',
    endDate: '2026-02-28T00:00:00Z',
    status: 'ACTIVE',
    signedDate: '2025-08-25T00:00:00Z',
    notes: 'Graduate internship cohort 2025.',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
] as const);

const MOVEMENTS: readonly EmployeeMovementSummary[] = Object.freeze([
  {
    employeeId: 'emp-0003',
    employeeName: 'Hana Suciati',
    employeeNumber: 'EMP-0003',
    id: 'mov-0001',
    movementType: 'PROMOTION',
    effectiveDate: '2026-04-01T00:00:00Z',
    fromUnitName: 'Customer Operations',
    toUnitName: 'Customer Operations',
    fromPositionName: 'Customer Success Officer',
    toPositionName: 'Team Lead Customer Success',
    reason: 'Consistent top satisfaction scores across three quarters.',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    employeeId: 'emp-0002',
    employeeName: 'Adeyemi Bergman',
    employeeNumber: 'EMP-0002',
    id: 'mov-0002',
    movementType: 'TRANSFER',
    effectiveDate: '2026-03-01T00:00:00Z',
    fromUnitName: 'Jakarta Head Office',
    toUnitName: 'Bandung Branch',
    fromPositionName: 'HR Officer',
    toPositionName: 'HR Officer',
    reason: 'Branch HR coverage rotation.',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    id: 'mov-0003',
    movementType: 'CHANGE',
    effectiveDate: '2025-10-01T00:00:00Z',
    fromUnitName: 'Product Engineering',
    toUnitName: 'Product Engineering',
    fromPositionName: 'Backend Developer',
    toPositionName: 'Senior Backend Developer',
    reason: 'Role level change after annual review.',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
] as const);

/** The employment-snapshot rows behind the Employment Information screen. */
export interface EmploymentInfoRow {
  readonly employeeId: string;
  readonly employeeName: string;
  readonly employeeNumber: string;
  readonly status: string;
  readonly employmentType: string;
  readonly contractType: string;
  readonly unit: string;
  readonly hireDate: string;
}

const EMPLOYMENT_INFO: readonly EmploymentInfoRow[] = Object.freeze([
  {
    employeeId: 'emp-0001',
    employeeName: 'Jordan Reyes',
    employeeNumber: 'EMP-0001',
    status: 'ACTIVE',
    employmentType: 'FULL_TIME',
    contractType: 'PERMANENT',
    unit: 'Product Engineering',
    hireDate: '2024-01-02T00:00:00Z',
  },
  {
    employeeId: 'emp-0002',
    employeeName: 'Adeyemi Bergman',
    employeeNumber: 'EMP-0002',
    status: 'ACTIVE',
    employmentType: 'FULL_TIME',
    contractType: 'PROBATION',
    unit: 'Jakarta Head Office',
    hireDate: '2026-01-01T00:00:00Z',
  },
  {
    employeeId: 'emp-0003',
    employeeName: 'Hana Suciati',
    employeeNumber: 'EMP-0003',
    status: 'ACTIVE',
    employmentType: 'FULL_TIME',
    contractType: 'FIXED_TERM',
    unit: 'Customer Operations',
    hireDate: '2025-07-01T00:00:00Z',
  },
  {
    employeeId: 'emp-0004',
    employeeName: 'Marcus Webb',
    employeeNumber: 'EMP-0004',
    status: 'ACTIVE',
    employmentType: 'INTERN',
    contractType: 'INTERNSHIP',
    unit: 'Data Analytics',
    hireDate: '2025-09-01T00:00:00Z',
  },
] as const);

const SORT = { createdAt: 'desc', id: 'desc' } as const;

function page<T extends { readonly id: string; readonly createdAt: string }>(
  all: readonly T[],
): { readonly items: T[] } {
  const params = normalisePageParams({});
  const fingerprint = cursorFingerprint({ filters: {}, sort: SORT });
  const resolution = resolveCursor(undefined, fingerprint);
  if (!resolution.ok) {
    throw new Error('The pagination cursor does not match the current filters');
  }
  const rows: T[] = [...all];
  const paginated = buildPage(rows, params, fingerprint, (item) => ({
    values: [item.createdAt, item.id],
  }));
  return { items: [...paginated.items] };
}

export function mockContracts(contractType?: string): {
  readonly items: EmploymentContractSummary[];
} {
  const rows =
    contractType === undefined
      ? CONTRACTS
      : CONTRACTS.filter((contract) => contract.contractType === contractType);
  return page(rows);
}

export function mockMovements(movementType?: string): {
  readonly items: EmployeeMovementSummary[];
} {
  const rows =
    movementType === undefined
      ? MOVEMENTS
      : MOVEMENTS.filter((movement) => movement.movementType === movementType);
  return page(rows);
}

export function mockEmploymentInfo(): { readonly items: EmploymentInfoRow[] } {
  return { items: [...EMPLOYMENT_INFO] };
}
