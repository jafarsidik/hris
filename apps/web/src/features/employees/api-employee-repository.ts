import { normalisePageParams } from '@hris/shared-types';

import { serverApiRequestV1 } from '@/lib/api/server-config';
import { sessionRequestOptions } from '@/lib/api/server-session';

import type {
  Employee,
  EmployeeDraft,
  EmployeePage,
  EmployeeQuery,
  EmployeeRepository,
} from './employee-types';

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
    const department = query.department ?? 'ALL';
    const employmentType = query.employmentType ?? 'ALL';
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
    if (department !== 'ALL') {
      searchParams.set('department', department);
    }
    if (employmentType !== 'ALL') {
      searchParams.set('employmentType', employmentType);
    }

    const data = await serverApiRequestV1<unknown>(
      `/employees?${searchParams.toString()}`,
      await sessionRequestOptions(
        // Directory reads are per-request: the caller may be a different user after a
        // session change, and a cached page would show the previous tenant's employees.
        { headers: { 'cache-control': 'no-store' } },
      ),
    );

    return parseEmployeePage(data);
  }

  async getById(id: string): Promise<Employee | null> {
    const data = await serverApiRequestV1<unknown>(
      `/employees/${encodeURIComponent(id)}`,
      await sessionRequestOptions({ headers: { 'cache-control': 'no-store' } }),
    );

    return parseEmployee(data);
  }

  async create(input: EmployeeDraft): Promise<Employee> {
    const data = await serverApiRequestV1<unknown>('/employees', {
      ...(await sessionRequestOptions()),
      method: 'POST',
      body: {
        // An empty userId tells the API to mint the backing user from the
        // name/email the form sent, which is the create-dialog flow.
        userId: input.id ?? '',
        employeeNumber: input.employeeNumber ?? '',
        userName: input.fullName,
        userEmail: input.email,
        organizationalUnitId: input.unitId ?? null,
        positionId: input.positionId ?? null,
        employmentType: input.employmentType,
        status: input.status,
        hireDate: input.hireDate,
      },
    });
    return parseEmployee(data);
  }

  async update(id: string, input: Partial<EmployeeDraft>): Promise<Employee> {
    const data = await serverApiRequestV1<unknown>(`/employees/${encodeURIComponent(id)}`, {
      ...(await sessionRequestOptions()),
      method: 'PATCH',
      body: {
        ...(input.employeeNumber !== undefined ? { employeeNumber: input.employeeNumber } : {}),
        ...(input.unitId !== undefined ? { organizationalUnitId: input.unitId } : {}),
        ...(input.positionId !== undefined ? { positionId: input.positionId } : {}),
        ...(input.employmentType !== undefined ? { employmentType: input.employmentType } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.hireDate !== undefined ? { hireDate: input.hireDate } : {}),
      },
    });
    return parseEmployee(data);
  }

  async delete(id: string): Promise<void> {
    await serverApiRequestV1<unknown>(`/employees/${encodeURIComponent(id)}`, {
      ...(await sessionRequestOptions()),
      method: 'DELETE',
    });
  }
}

/**
 * Checks that a single-employee response has every field the UI reads.
 *
 * A returned 404 for an unknown id would surface as an `ApiRequestError`; a well-formed
 * envelope carrying a record with fields missing would crash rendering instead. The
 * strict check keeps the failure at the repository boundary where it is legible.
 */
function parseEmployee(data: unknown): Employee {
  if (typeof data !== 'object' || data === null) {
    throw new TypeError('Employee response was not an object');
  }

  const candidate = data as Partial<Record<keyof Employee, unknown>>;

  for (const field of [
    'id',
    'employeeNumber',
    'fullName',
    'email',
    'employmentType',
    'hireDate',
    'status',
  ] as const) {
    if (typeof candidate[field] !== 'string') {
      throw new TypeError(`Employee response had a malformed ${field}`);
    }
  }

  // An employee may legitimately sit in no unit and hold no position yet: the API
  // answers those as null. The UI consumes labels, so blanks are the honest mapping.
  const department = candidate['department'];
  const jobTitle = candidate['jobTitle'];
  if (department !== null && typeof department !== 'string') {
    throw new TypeError('Employee response had a malformed department');
  }
  if (jobTitle !== null && typeof jobTitle !== 'string') {
    throw new TypeError('Employee response had a malformed jobTitle');
  }

  return {
    id: candidate['id'] as string,
    employeeNumber: candidate['employeeNumber'] as string,
    fullName: candidate['fullName'] as string,
    email: candidate['email'] as string,
    jobTitle: jobTitle ?? '',
    department: department ?? '',
    employmentType: candidate['employmentType'] as string,
    hireDate: candidate['hireDate'] as string,
    status: candidate['status'] as string,
  };
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
