import type { PageParams, Paginated } from '@hris/shared-types';

/**
 * The employee record as the UI consumes it.
 *
 * Flat and already-formatted: the date is a string and the department is a label, not an
 * id. The alternative — passing raw rows and letting the view resolve ids — pushes a
 * second lookup onto every caller and puts a `department_id` in the markup if anyone
 * forgets. Shaping happens once, at the repository boundary.
 */
export interface Employee {
  readonly id: string;
  readonly employeeNumber: string;
  readonly fullName: string;
  readonly email: string;
  readonly jobTitle: string;
  readonly department: string;
  readonly employmentType: string;
  /** ISO 8601 date. Formatted for display at the point of rendering. */
  readonly hireDate: string;
  readonly status: string;
}

export type EmployeeSort = 'name' | 'hireDate';

/**
 * The fields a form submits to create or update an employee.
 *
 * `employeeNumber` is only present on edit: a create hands the row to the server so it
 * can allocate the next number in sequence, which keeps one authority for identity. All
 * values are raw form strings; validation and trimming happen server-side in the save
 * action, not here.
 */
export interface EmployeeDraft {
  readonly id?: string;
  readonly fullName: string;
  readonly email: string;
  readonly jobTitle: string;
  readonly department: string;
  readonly employmentType: string;
  readonly hireDate: string;
  readonly status: string;
  readonly employeeNumber?: string;
  /** The unit an employee sits in, as the API defines it; a label lives in `department`. */
  readonly unitId?: string;
  /** The position an employee holds, as the API defines it; a label lives in `jobTitle`. */
  readonly positionId?: string;
}

/**
 * The filters a caller may apply to the employee list.
 *
 * Every field participates in the cursor fingerprint. Adding one here without adding it
 * to the fingerprint spec would let a cursor issued for one filter set be replayed
 * against another, returning a page from the wrong result set — the specific failure
 * cursor pagination exists to prevent.
 */
export interface EmployeeQuery {
  /** Free-text match against name, email and employee number. */
  readonly search?: string;
  readonly status?: string;
  readonly department?: string;
  readonly employmentType?: string;
  readonly sort?: EmployeeSort;
  readonly page?: PageParams;
}

export type EmployeePage = Paginated<Employee>;

/**
 * Read and write access to employee data.
 */
export interface EmployeeRepository {
  list(query: EmployeeQuery): Promise<EmployeePage>;
  /** The record with the given id, or `null` when it is not in this source. */
  getById(id: string): Promise<Employee | null>;
  /** Creates a record and returns it with any server-assigned fields (e.g. number). */
  create(input: EmployeeDraft): Promise<Employee>;
  /** Updates a record and returns it. */
  update(id: string, input: Partial<EmployeeDraft>): Promise<Employee>;
  /** Soft-deletes a record. */
  delete(id: string): Promise<void>;
}
