import 'server-only';

import { apiEmployeeRepository } from './api-employee-repository';
import { mockEmployeeRepository } from './mock-employee-repository';
import type { EmployeeRepository } from './employee-types';

/**
 * Chooses the employee data source.
 *
 * Defaults to the mock. That is the whole point of the switch: the directory screen can
 * be built, reviewed and demoed now, and flipping one variable replaces the source once
 * the endpoint exists — with no change to the page or the table.
 *
 * Server-side only, for two reasons. `HRIS_EMPLOYEE_DATA_SOURCE` is not a
 * `NEXT_PUBLIC_*` value, so it must not reach the bundle and decide behaviour from the
 * client, where it could be flipped by anyone with devtools. And the API repository
 * resolves the internal base URL, which is not reachable from a browser.
 *
 * An unrecognised value fails loudly rather than falling back to the mock. A typo in
 * production would otherwise serve mock people and look like it worked.
 */

export type EmployeeDataSource = 'mock' | 'api';

export const isEmployeeDataSource = (value: string): value is EmployeeDataSource =>
  value === 'mock' || value === 'api';

export function getEmployeeRepository(): EmployeeRepository {
  const configured = process.env['HRIS_EMPLOYEE_DATA_SOURCE'] ?? 'mock';

  if (!isEmployeeDataSource(configured)) {
    throw new Error(`HRIS_EMPLOYEE_DATA_SOURCE must be "mock" or "api", received "${configured}"`);
  }

  return configured === 'api' ? apiEmployeeRepository : mockEmployeeRepository;
}

export { InvalidCursorError } from './mock-employee-repository';
export type {
  Employee,
  EmployeeDraft,
  EmployeePage,
  EmployeeQuery,
  EmployeeRepository,
  EmployeeSort,
} from './employee-types';
export {
  EMPLOYEE_STATUSES,
  MOCK_DEPARTMENTS,
  MOCK_EMPLOYMENT_TYPES,
} from './mock-employee-repository';
