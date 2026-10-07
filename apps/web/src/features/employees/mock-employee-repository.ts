import {
  buildPage,
  cursorFingerprint,
  normalisePageParams,
  resolveCursor,
  toFetchLimit,
  type CursorPosition,
} from '@hris/shared-types';

import type {
  Employee,
  EmployeePage,
  EmployeeQuery,
  EmployeeRepository,
  EmployeeSort,
} from './employee-types';
import { getStoredEmployees } from './mock-employee-store';

/**
 * An in-memory employee directory used before the employee endpoint exists.
 *
 * This is a placeholder for the data source, not a fixture for the UI. It exists so the
 * directory screen can be built and reviewed now, and it goes away when
 * {@link EmployeeRepository} is served by the API.
 *
 * Two properties keep it from misleading whoever builds against it.
 *
 * **It is deterministic.** No `Math.random`, no `Date.now`, and a fixed PRNG seed, so the
 * same 43 rows appear in the same order on every run and in every environment. A
 * directory that reshuffles on each render makes a cursor bug indistinguishable from
 * noise, and makes the page untestable without stubbing.
 *
 * **It paginates by keyset, not by offset.** It calls the same `buildPage` and
 * `resolveCursor` helpers a real endpoint will, and walks the sort key rather than
 * skipping a number. An offset-based mock would pass against a UI with an off-by-one in
 * its cursor handling and fail against the API, which is the opposite of what a
 * placeholder is for.
 */

const EMPLOYEE_COUNT = 43;
const SEED = 0x5f3a91;

/** Deterministic PRNG. Returns a float in [0, 1). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  'Amara',
  'Andres',
  'Beatriz',
  'Caleb',
  'Chen',
  'Dalia',
  'Diego',
  'Elena',
  'Farhan',
  'Grace',
  'Hana',
  'Ibrahim',
  'Ingrid',
  'Jamal',
  'Jonas',
  'Karin',
  'Kwame',
  'Lars',
  'Leila',
  'Malik',
  'Mei',
  'Nadia',
  'Noor',
  'Oscar',
  'Priya',
  'Rafael',
  'Sanne',
  'Tariq',
  'Valentina',
  'Wei',
  'Yusuf',
  'Zara',
] as const;

const LAST_NAMES = [
  'Adeyemi',
  'Bergman',
  'Castillo',
  'Dubois',
  'Eriksen',
  'Fontaine',
  'Gupta',
  'Haddad',
  'Ibrahim',
  'Jansen',
  'Kowalski',
  'Lindqvist',
  'Mensah',
  'Nakamura',
  'Okafor',
  'Petrov',
  'Quintero',
  'Rossi',
  'Silva',
  'Tanaka',
  'Ueda',
  'Vargas',
  'Walsh',
  'Yilmaz',
] as const;

const DEPARTMENTS = [
  'Engineering',
  'Finance',
  'People Operations',
  'Product',
  'Sales',
  'Support',
] as const;

const JOB_TITLES_BY_DEPARTMENT: Readonly<Record<string, readonly string[]>> = {
  Engineering: [
    'Backend Engineer',
    'Frontend Engineer',
    'Platform Engineer',
    'Engineering Manager',
  ],
  Finance: ['Financial Analyst', 'Payroll Specialist', 'Controller'],
  'People Operations': ['People Partner', 'Recruiter', 'People Operations Lead'],
  Product: ['Product Manager', 'Product Designer', 'Product Analyst'],
  Sales: ['Account Executive', 'Sales Development Representative', 'Sales Manager'],
  Support: ['Support Specialist', 'Support Engineer', 'Support Team Lead'],
};

/**
 * The departments a record may belong to.
 *
 * Exported so the save action can validate against the same options the directory was
 * generated from, instead of mirroring the list a third time.
 */
export const MOCK_DEPARTMENTS: readonly string[] = [...DEPARTMENTS];

const EMPLOYMENT_TYPES = ['Full time', 'Part time', 'Contract', 'Intern'] as const;

/** Employment types the save action validates against. @see MOCK_DEPARTMENTS */
export const MOCK_EMPLOYMENT_TYPES: readonly string[] = [...EMPLOYMENT_TYPES];

/**
 * Statuses present in the directory.
 *
 * `INACTIVE` and `TERMINATED` are included so the status filter has something to filter
 * on; a directory containing only active staff makes the filter look decorative.
 */
export const EMPLOYEE_STATUSES = ['ACTIVE', 'ON_LEAVE', 'PROBATION', 'INACTIVE'] as const;

const STATUSES = EMPLOYEE_STATUSES;

/**
 * Orders strings by code unit rather than by locale.
 *
 * `localeCompare` and `Intl.Collator` are more correct for human names, but their result
 * depends on the ICU data in the runtime. A sort that differs between the developer's
 * machine and CI would make the mock disagree with the assertions written against it,
 * so the tie-break has to be fixed in the source instead. Replace this with a
 * server-supplied `order` field once the API exists.
 */
const compareStrings = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function generateEmployees(): readonly Employee[] {
  const random = mulberry32(SEED);

  return Array.from({ length: EMPLOYEE_COUNT }, (_, index) => {
    const firstName = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)] ?? 'Alex';
    const lastName = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)] ?? 'Reyes';
    const department = DEPARTMENTS[Math.floor(random() * DEPARTMENTS.length)] ?? 'Engineering';
    const titles = JOB_TITLES_BY_DEPARTMENT[department] ?? ['Specialist'];
    const jobTitle = titles[Math.floor(random() * titles.length)] ?? titles[0] ?? 'Specialist';
    const status = STATUSES[Math.floor(random() * STATUSES.length)] ?? 'ACTIVE';
    const employmentType =
      EMPLOYMENT_TYPES[Math.floor(random() * EMPLOYMENT_TYPES.length)] ?? 'Full time';

    // Spread hire dates across roughly eight years back from a fixed date rather than
    // from today, so the dataset does not drift as the wall clock moves.
    const dayOffset = Math.floor(random() * 2920);
    const hireDate = new Date(Date.UTC(2018, 0, 1) + dayOffset * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const sequence = String(index + 1).padStart(4, '0');

    return {
      id: `emp-${sequence}`,
      employeeNumber: `EMP-${sequence}`,
      fullName: `${firstName} ${lastName}`,
      email: `${firstName}.${lastName}@example.com`.toLowerCase(),
      jobTitle,
      department,
      employmentType,
      hireDate,
      status,
    };
  });
}

/**
 * The generated set, built once per process.
 */
const EMPLOYEES: readonly Employee[] = generateEmployees();

/**
 * The generated set overlaid with whatever the mock store holds.
 *
 * A stored record both replaces a generated row with the same id (an edit) and adds rows
 * with ids the generator never made (a create). Using the map makes the overlay
 * idempotent: reading the store twice yields the same rows, which keeps listing
 * deterministic for a given process lifetime.
 */
function allEmployees(): readonly Employee[] {
  const stored = getStoredEmployees();
  if (stored.length === 0) return EMPLOYEES;

  const merged = new Map(EMPLOYEES.map((employee) => [employee.id, employee] as const));
  for (const employee of stored) merged.set(employee.id, employee);
  return [...merged.values()];
}

/**
 * The `Employee` field each sort orders by.
 *
 * Typed as literal keys, not `string`: widening it to `string` would turn every indexed
 * access below into an unchecked lookup against a type with no index signature.
 */
const SORT_KEYS: Readonly<Record<EmployeeSort, 'fullName' | 'hireDate'>> = {
  name: 'fullName',
  hireDate: 'hireDate',
};

/**
 * Compares against the sort key, then by id.
 *
 * The id tie-break is what makes the ordering total. Without it, two employees sharing a
 * surname and a hire date have no defined order, and the keyset filter can skip or
 * repeat one of them at a page boundary — the classic duplicate-row cursor bug.
 */
function compare(a: Employee, b: Employee, sort: EmployeeSort): number {
  const key = SORT_KEYS[sort];
  const byKey = compareStrings(a[key], b[key]);
  return byKey !== 0 ? byKey : compareStrings(a.id, b.id);
}

const toPosition = (employee: Employee, sort: EmployeeSort): CursorPosition => ({
  values: sort === 'name' ? [employee.fullName, employee.id] : [employee.hireDate, employee.id],
});

/**
 * The employee a cursor position points at, or undefined when the id is unknown.
 *
 * Only the id is read. The sort key is carried in the cursor so a client can see it, but
 * it is not needed to re-find the row, and trusting it instead of the id would let a
 * mismatched pair position the walk inconsistently.
 */
function positionToEmployee(values: readonly unknown[]): Employee | undefined {
  const id = values[1];
  return typeof id === 'string' ? allEmployees().find((employee) => employee.id === id) : undefined;
}

function matchesFilters(employee: Employee, query: EmployeeQuery): boolean {
  if (query.status !== undefined && query.status !== 'ALL' && employee.status !== query.status) {
    return false;
  }

  if (query.search !== undefined && query.search !== '') {
    const needle = query.search.trim().toLowerCase();
    const haystack =
      `${employee.fullName} ${employee.email} ${employee.employeeNumber} ${employee.department}`.toLowerCase();
    if (!haystack.includes(needle)) {
      return false;
    }
  }

  return true;
}

class MockEmployeeRepository implements EmployeeRepository {
  async list(query: EmployeeQuery): Promise<EmployeePage> {
    const params = normalisePageParams(query.page ?? {});
    const sort: EmployeeSort = query.sort ?? 'name';

    const filters = { search: query.search?.trim() ?? '', status: query.status ?? 'ALL' };
    const fingerprint = cursorFingerprint({ filters, sort });

    const resolution = resolveCursor(query.page?.cursor, fingerprint);
    if (!resolution.ok) {
      // A cursor from a different filter set is a client error, not an empty result.
      // Returning an empty page here would look like "no employees match", which is a
      // materially different and wrong conclusion.
      throw new InvalidCursorError();
    }

    const anchor =
      resolution.cursor.position.values.length > 0
        ? positionToEmployee(resolution.cursor.position.values)
        : undefined;

    const ordered = allEmployees()
      .filter((employee) => matchesFilters(employee, query))
      .sort((left, right) => compare(left, right, sort));

    const afterAnchor =
      anchor === undefined
        ? ordered
        : ordered.filter((employee) => compare(employee, anchor, sort) > 0);

    // The surplus row is what proves another page exists, which is why the window is
    // fetched at limit + 1 rather than limit.
    const window = afterAnchor.slice(0, toFetchLimit(params));

    return buildPage(window, params, fingerprint, (employee) => toPosition(employee, sort));
  }

  async getById(id: string): Promise<Employee | null> {
    return allEmployees().find((employee) => employee.id === id) ?? null;
  }
}

/** Raised when a cursor does not belong to the filter set it is replayed against. */
export class InvalidCursorError extends Error {
  constructor() {
    super('The pagination cursor does not belong to this query');
    this.name = 'InvalidCursorError';
  }
}

export const mockEmployeeRepository: EmployeeRepository = new MockEmployeeRepository();
