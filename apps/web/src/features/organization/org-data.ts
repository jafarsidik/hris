/**
 * Deterministic organization reference rows mirroring the API contracts:
 * units (departments) and positions come from the organization / employees
 * modules, work locations from the locations module.
 */

export interface UnitRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: string;
  readonly parent: string | null;
  readonly headcount: number;
}

export const UNITS: readonly UnitRow[] = Object.freeze([
  {
    id: 'unit-0001',
    code: 'ORG-GLOBAL',
    name: 'Global Headquarters',
    type: 'COMPANY',
    parent: null,
    headcount: 0,
  },
  {
    id: 'unit-0002',
    code: 'LOC-ID',
    name: 'Indonesia Entity',
    type: 'LEGAL_ENTITY_GROUP',
    parent: 'Global Headquarters',
    headcount: 0,
  },
  {
    id: 'unit-0003',
    code: 'DEPT-ENG',
    name: 'Engineering',
    type: 'DEPARTMENT',
    parent: 'Indonesia Entity',
    headcount: 42,
  },
  {
    id: 'unit-0004',
    code: 'DEPT-FIN',
    name: 'Finance',
    type: 'DEPARTMENT',
    parent: 'Indonesia Entity',
    headcount: 12,
  },
  {
    id: 'unit-0005',
    code: 'DEPT-POPS',
    name: 'People Operations',
    type: 'DEPARTMENT',
    parent: 'Indonesia Entity',
    headcount: 9,
  },
  {
    id: 'unit-0006',
    code: 'DEPT-PROD',
    name: 'Product',
    type: 'DEPARTMENT',
    parent: 'Indonesia Entity',
    headcount: 15,
  },
  {
    id: 'unit-0007',
    code: 'DEPT-SALES',
    name: 'Sales',
    type: 'DEPARTMENT',
    parent: 'Indonesia Entity',
    headcount: 21,
  },
  {
    id: 'unit-0008',
    code: 'DEPT-SUP',
    name: 'Support',
    type: 'DEPARTMENT',
    parent: 'Indonesia Entity',
    headcount: 17,
  },
  {
    id: 'unit-0009',
    code: 'TEAM-BE',
    name: 'Backend Team',
    type: 'TEAM',
    parent: 'Engineering',
    headcount: 11,
  },
  {
    id: 'unit-0010',
    code: 'TEAM-FE',
    name: 'Frontend Team',
    type: 'TEAM',
    parent: 'Engineering',
    headcount: 8,
  },
] as const);

export interface PositionRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly department: string;
  readonly grade: string | null;
  readonly active: boolean;
  readonly headcount: number;
}

export const POSITIONS: readonly PositionRow[] = Object.freeze([
  {
    id: 'pos-0001',
    code: 'POS-ENG-001',
    name: 'Backend Engineer',
    department: 'Engineering',
    grade: 'P3',
    active: true,
    headcount: 9,
  },
  {
    id: 'pos-0002',
    code: 'POS-ENG-002',
    name: 'Frontend Engineer',
    department: 'Engineering',
    grade: 'P3',
    active: true,
    headcount: 6,
  },
  {
    id: 'pos-0003',
    code: 'POS-ENG-003',
    name: 'Engineering Manager',
    department: 'Engineering',
    grade: 'M2',
    active: true,
    headcount: 2,
  },
  {
    id: 'pos-0004',
    code: 'POS-FIN-001',
    name: 'Financial Analyst',
    department: 'Finance',
    grade: 'P2',
    active: true,
    headcount: 3,
  },
  {
    id: 'pos-0005',
    code: 'POS-POPS-001',
    name: 'People Partner',
    department: 'People Operations',
    grade: 'P3',
    active: true,
    headcount: 2,
  },
  {
    id: 'pos-0006',
    code: 'POS-SAL-001',
    name: 'Account Executive',
    department: 'Sales',
    grade: 'P2',
    active: true,
    headcount: 5,
  },
  {
    id: 'pos-0007',
    code: 'POS-PROD-001',
    name: 'Product Designer',
    department: 'Product',
    grade: 'P2',
    active: false,
    headcount: 0,
  },
] as const);

export interface LocationRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly city: string;
  readonly country: string;
  readonly address: string;
  readonly timezone: string;
  readonly isHeadquarters: boolean;
}

export const LOCATIONS: readonly LocationRow[] = Object.freeze([
  {
    id: 'loc-0001',
    code: 'JKT-HQ',
    name: 'Jakarta Head Office',
    city: 'Jakarta',
    country: 'Indonesia',
    address: 'Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan',
    timezone: 'Asia/Jakarta',
    isHeadquarters: true,
  },
  {
    id: 'loc-0002',
    code: 'BDG-BR',
    name: 'Bandung Branch',
    city: 'Bandung',
    country: 'Indonesia',
    address: 'Jl. Asia Afrika No. 8, Bandung',
    timezone: 'Asia/Jakarta',
    isHeadquarters: false,
  },
  {
    id: 'loc-0003',
    code: 'SNG-HUB',
    name: 'Singapore Hub',
    city: 'Singapore',
    country: 'Singapore',
    address: '1 Fusionopolis Way, Connexis North',
    timezone: 'Asia/Singapore',
    isHeadquarters: false,
  },
] as const);

/** Build the parent → children map used by the org tree screens. */
export function unitChildren(): Map<string, readonly UnitRow[]> {
  const byParent = new Map<string, UnitRow[]>();
  for (const unit of UNITS) {
    const key = unit.parent ?? '';
    const list = byParent.get(key) ?? [];
    list.push(unit);
    byParent.set(key, list);
  }
  return byParent;
}
