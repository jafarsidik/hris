import { normalisePageParams } from '@hris/shared-types';

import { serverApiRequestV1 } from '@/lib/api/server-config';

import type { Employee, EmployeePage, EmployeeQuery, EmployeeRepository } from './employee-types';

/**
 * Reads employees from the API.
 *
 * Written now so the screen is built against the real contract rather than against the
 * mock's conveniences, but **not yet reachable**: {@link getEmployeeRepository} selects
 * the mock by default, because `/employees` does not exist on the API and switching this
 * on would only turn the directory into a 404.
 *
 * Two things this deliberately does not paper over.
 *
 * `sort` is sent as a value the endpoint defines, not as a column name. The mock's
 * keyset walk and the real one must order by the same thing, so the sort is part of the
 * request contract rather than a UI concern.
 *
 * A rejected cursor surfaces as `ApiRequestError` from `http-client`, which already maps
 * it to `VALIDATION_ERROR`. The mock throws {@link InvalidCursorError} for the same
 * condition because it has no HTTP layer to do it; the page treats both as "start over"
 * rather than assuming one shape.
 */
class ApiEmployeeRepository implements EmployeeRepository {
  async list(query: EmployeeQuery): Promise<EmployeePage> {
    const params = normalisePageParams(query.page ?? {});
    const search = query.search?.trim() ?? '';
    const status = query.status ?? 'ALL';
    const sort = query.sort ?? 'name';

    const searchParams = new URLSearchParams({ limit: String(params.limit), sort });

    if (params.cursor !== undefined) {
      searchParams.set('cursor', params.cursor);
    }
    // An empty `search` would otherwise be sent as `search=` and rejected as an invalid
    // filter by a strict validator, which turns "no filter" into an error.
    if (search !== '') {
      searchParams.set('search', search);
    }
    if (status !== 'ALL') {
      searchParams.set('status', status);
    }

    const data = await serverApiRequestV1<unknown>(
      `/employees?${searchParams.toString()}`,
      // Directory reads are per-request: the caller may be a different user after a
      // session change, and a cached page would show the previous tenant's employees.
      { headers: { 'cache-control': 'no-store' } },
    );

    return parseEmployeePage(data);
  }

  async getById(id: string): Promise<Employee | null> {
    const data = await serverApiRequestV1<unknown>(`/employees/${encodeURIComponent(id)}`, {
      headers: { 'cache-control': 'no-store' },
    });

    return parseEmployee(data);
  }
}

/**
 * Checks that a single-employee response has every field the UI reads.
 *
 * A returned 404 for an unknown id would surface as an `ApiRequestError`; a well-formed
 * envelope carrying a record with fields missing would crash rendering instead. The
 * strict check keeps the failure at the repository boundary where it is legible.
 */
function parseEmployee(data: unknown): Employee | null {
  if (typeof data !== 'object' || data === null) {
    throw new TypeError('Employee response was not an object');
  }

  const candidate = data as Partial<Employee>;
  const required: readonly (keyof Employee)[] = [
    'id',
    'employeeNumber',
    'fullName',
    'email',
    'jobTitle',
    'department',
    'employmentType',
    'hireDate',
    'status',
  ];

  for (const field of required) {
    if (typeof candidate[field] !== 'string') {
      throw new TypeError(`Employee response had a malformed ${field}`);
    }
  }

  return candidate as Employee;
}

/**
 * Checks the response shape before trusting it.
 *
 * `http-client` proves the envelope was well formed; it says nothing about whether
 * `data` is an employee page. Without this the view would read `pageInfo.endCursor` off
 * whatever came back and crash deep in rendering, instead of failing here where the
 * reason is legible.
 */
function parseEmployeePage(data: unknown): EmployeePage {
  if (typeof data !== 'object' || data === null) {
    throw new TypeError('Employee page response was not an object');
  }

  const candidate = data as Partial<EmployeePage>;

  if (!Array.isArray(candidate.items)) {
    throw new TypeError('Employee page response had no items array');
  }
  if (typeof candidate.pageInfo !== 'object' || candidate.pageInfo === null) {
    throw new TypeError('Employee page response had no pageInfo');
  }
  if (typeof candidate.pageInfo.hasNextPage !== 'boolean') {
    throw new TypeError('Employee page response had no hasNextPage flag');
  }
  if (candidate.pageInfo.endCursor !== null && typeof candidate.pageInfo.endCursor !== 'string') {
    throw new TypeError('Employee page response had a malformed endCursor');
  }

  return {
    items: candidate.items as Employee[],
    pageInfo: {
      hasNextPage: candidate.pageInfo.hasNextPage,
      endCursor: candidate.pageInfo.endCursor,
    },
  };
}

export const apiEmployeeRepository: EmployeeRepository = new ApiEmployeeRepository();
