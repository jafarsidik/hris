import { EMPTY_FILTERS, type DataTableSortState, type FilterState } from '@/components/data-table';

import type { EmployeeQuery, EmployeeSort } from './employee-types';
import {
  EMPLOYEE_STATUSES,
  MOCK_DEPARTMENTS,
  MOCK_EMPLOYMENT_TYPES,
} from './mock-employee-repository';

/**
 * The parameters a deep link can pin on the directory.
 *
 * This is the page's whole contract with the two consumers that outlive it: the URL
 * query string (read by the server page) and the dashboard's "Add employee" entry. It
 * is deliberately the same set of knobs the table exposes, so a URL can narrow the
 * directory to "ACTIVE Engineering contractors" and the table opens already matching.
 *
 * Filters here are a *first paint*, not a live binding. Every change after load lives
 * in the table's own state; the URL is only re-read on the next navigation.
 */

export interface EmployeeListParams {
  search?: string;
  status?: string;
  department?: string;
  employmentType?: string;
  sort?: EmployeeSort;
}

const SORTS: readonly EmployeeSort[] = ['name', 'hireDate'];

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

function pick(known: readonly string[], candidate: string | undefined): string | undefined {
  return candidate !== undefined && known.includes(candidate) ? candidate : undefined;
}

/** Parses the directory query string, dropping any value the directory cannot honour. */
export function parseEmployeeListParams(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
): EmployeeListParams {
  const params: EmployeeListParams = {
    status: pick(EMPLOYEE_STATUSES, firstValue(searchParams['status'])),
    department: pick(MOCK_DEPARTMENTS, firstValue(searchParams['department'])),
    employmentType: pick(MOCK_EMPLOYMENT_TYPES, firstValue(searchParams['employmentType'])),
    sort: SORTS.find((candidate) => candidate === firstValue(searchParams['sort'])),
  };

  const search = (firstValue(searchParams['search']) ?? '').slice(0, 200).trim();
  // An empty string means "no filter". The table reads the absence of a key as "all",
  // so leaving the field unset is the honest encoding of "don't narrow".
  if (search !== '') params.search = search;

  return params;
}

/** The repository query the server page runs for the given URL parameters. */
export function toEmployeeQuery(params: EmployeeListParams): EmployeeQuery {
  return {
    search: params.search,
    status: params.status ?? 'ALL',
    department: params.department ?? 'ALL',
    employmentType: params.employmentType ?? 'ALL',
    sort: params.sort ?? 'name',
  };
}

/** The table's initial filters, derived once from the URL and handed to the directory. */
export function toInitialFilterState(params: EmployeeListParams): FilterState {
  const select: Record<string, string> = {};
  if (params.status !== undefined) select['status'] = params.status;
  if (params.department !== undefined) select['department'] = params.department;
  if (params.employmentType !== undefined) select['employmentType'] = params.employmentType;

  return Object.keys(select).length === 0 ? EMPTY_FILTERS : { ...EMPTY_FILTERS, select };
}

/** The table's initial sort, matched to the column ids the directory declares. */
export function toInitialSort(params: EmployeeListParams): DataTableSortState | undefined {
  if (params.sort === undefined) return undefined;
  return { columnId: params.sort, direction: 'asc' };
}
