'use server';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@hris/shared-types';

import {
  EMPLOYEE_STATUSES,
  MOCK_DEPARTMENTS,
  MOCK_EMPLOYMENT_TYPES,
  getEmployeeRepository,
  type Employee,
  type EmployeeDraft,
} from '@/features/employees';
import { upsertStoredEmployee } from '@/features/employees/mock-employee-store';
import { InvalidCursorError } from '@/features/employees/mock-employee-repository';
import type { EmployeePage, EmployeeSort } from '@/features/employees/employee-types';

/**
 * Fetches the next page of employees for the directory's "load more" control.
 *
 * A server action rather than a client-side `fetch` for one reason: the data source may
 * be the mock, which lives in this process. A client fetch would need a route handler
 * bridging to the repository, which is a second way to reach the same data and would
 * have to be kept in step with the repository's behaviour.
 *
 * The return value is a discriminated result rather than a thrown error. Throwing across
 * the action boundary does not preserve the error class, and a `VALIDATION_ERROR` that
 * arrives as an opaque `Error` cannot be told apart from a genuine crash — the caller
 * would then discard the user's filters instead of resetting the cursor.
 */

const SORTS: readonly EmployeeSort[] = ['name', 'hireDate'];

export type LoadMoreResult =
  | { readonly ok: true; readonly page: EmployeePage }
  | {
      readonly ok: false;
      /** The caller should drop its cursor and restart from the first page. */
      readonly reason: 'INVALID_CURSOR';
    };

/** Coerces an untrusted value to a bounded integer. */
const toLimit = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(value, MAX_PAGE_SIZE);
};

export async function loadMoreEmployees(input: {
  cursor: unknown;
  search?: unknown;
  status?: unknown;
  sort?: unknown;
  limit?: unknown;
}): Promise<LoadMoreResult> {
  const sort = SORTS.includes(input.sort as EmployeeSort) ? (input.sort as EmployeeSort) : 'name';
  const search = typeof input.search === 'string' ? input.search : undefined;
  const status = typeof input.status === 'string' ? input.status : undefined;

  try {
    const page = await getEmployeeRepository().list({
      search,
      status,
      sort,
      page: {
        limit: toLimit(input.limit),
        // Not forwarded unless it is a non-empty string. The repository is the
        // authority on whether a cursor is valid; the only job here is to hand it a
        // value or nothing at all, never a coerced one.
        cursor: typeof input.cursor === 'string' && input.cursor !== '' ? input.cursor : undefined,
      },
    });

    return { ok: true, page };
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      return { ok: false, reason: 'INVALID_CURSOR' };
    }
    // Anything else — including an ApiRequestError from the API repository — is a real
    // failure and is allowed to propagate to the route error boundary, where the
    // user-facing copy lives. Swallowing it here would turn an outage into a blank table.
    throw error;
  }
}

/**
 * The result of a save: either the saved record and what the form did, or field errors
 * keyed by the name of the field they belong to. A discriminated union, so the form can
 * distinguish "saved" from "fix these fields" without inspecting shape.
 */
export type SaveEmployeeResult =
  | { readonly ok: true; readonly mode: 'created' | 'updated'; readonly employee: Employee }
  | { readonly ok: false; readonly fieldErrors: Readonly<Record<string, string>> };

type FieldErrors = Record<string, string>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Reads a field, coercing anything non-string (files, absent names) to an empty string. */
const readString = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

/** Date is valid calendar-wise and not in the future. */
function isValidHireDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return parsed.getTime() <= today;
}

/** The elements of the sort tie-break id (`emp-0001`) as a number, or 0. */
const numericId = (id: string): number => {
  const match = /^emp-(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
};

/**
 * Validates the raw draft into field errors. Validation lives here, server-side, so the
 * rules are the authority even if a client submits the form without running any script.
 */
function validateDraft(draft: EmployeeDraft): FieldErrors {
  const errors: FieldErrors = {};
  const { fullName, email, jobTitle, department, employmentType, hireDate, status } = draft;

  if (fullName.trim().length < 2) errors.fullName = 'Full name must be at least 2 characters.';
  else if (fullName.length > 120) errors.fullName = 'Full name must be 120 characters or fewer.';

  if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address.';

  if (jobTitle.trim() === '') errors.jobTitle = 'Job title is required.';
  if (!MOCK_DEPARTMENTS.includes(department)) errors.department = 'Choose a department.';
  if (!MOCK_EMPLOYMENT_TYPES.includes(employmentType))
    errors.employmentType = 'Choose an employment type.';
  if (!isValidHireDate(hireDate)) errors.hireDate = 'Enter a valid hire date, not in the future.';
  if (!(EMPLOYEE_STATUSES as readonly string[]).includes(status))
    errors.status = 'Choose a status.';

  return errors;
}

/** All rows currently served by the repository — generated plus stored overrides. */
async function allEmployeeRecords(): Promise<readonly Employee[]> {
  const page = await getEmployeeRepository().list({ page: { limit: MAX_PAGE_SIZE } });
  return page.items;
}

/** Allocates the next `emp-NNNN` id and `EMP-NNNN` number strictly above the current rows. */
function allocateIdentityFor(
  records: readonly Employee[],
): Pick<Employee, 'id' | 'employeeNumber'> {
  const sequence = records.reduce((max, employee) => Math.max(max, numericId(employee.id)), 0) + 1;
  const padded = String(sequence).padStart(4, '0');
  return { id: `emp-${padded}`, employeeNumber: `EMP-${padded}` };
}

export async function saveEmployee(
  _previous: SaveEmployeeResult,
  formData: FormData,
): Promise<SaveEmployeeResult> {
  const draft: EmployeeDraft = {
    id: readString(formData, 'id') || undefined,
    fullName: readString(formData, 'fullName'),
    email: readString(formData, 'email'),
    jobTitle: readString(formData, 'jobTitle'),
    department: readString(formData, 'department'),
    employmentType: readString(formData, 'employmentType'),
    hireDate: readString(formData, 'hireDate'),
    status: readString(formData, 'status'),
    employeeNumber: readString(formData, 'employeeNumber') || undefined,
  };

  const errors = validateDraft(draft);
  if (Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  const records = await allEmployeeRecords();
  const emailTaken = records.some(
    (employee) => employee.email === draft.email.trim().toLowerCase() && employee.id !== draft.id,
  );
  if (emailTaken) {
    return { ok: false, fieldErrors: { email: 'Another employee already uses this email.' } };
  }

  const identity =
    draft.id !== undefined
      ? { id: draft.id, employeeNumber: draft.employeeNumber ?? draft.id }
      : allocateIdentityFor(records);

  const employee: Employee = {
    id: identity.id,
    employeeNumber: identity.employeeNumber,
    fullName: draft.fullName.trim().replace(/\s+/g, ' '),
    email: draft.email.trim().toLowerCase(),
    jobTitle: draft.jobTitle.trim(),
    department: draft.department,
    employmentType: draft.employmentType,
    hireDate: draft.hireDate,
    status: draft.status,
  };

  upsertStoredEmployee(employee);
  return { ok: true, mode: draft.id === undefined ? 'created' : 'updated', employee };
}

/**
 * A compact match for the command palette's people search.
 *
 * The `Employee` shape already carries exactly what the palette renders, so no reshaping
 * happens here; the field list exists to keep the palette decoupled from the directory
 * record in case the two ever diverge.
 */
export type PeopleSearchResult = {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly employeeNumber: string;
  readonly department: string;
  readonly jobTitle: string;
  readonly hireDate: string;
  readonly status: string;
};

export async function searchPeople(search: unknown): Promise<readonly PeopleSearchResult[]> {
  const needle = typeof search === 'string' ? search.trim() : '';
  if (needle === '') return [];

  const page = await getEmployeeRepository().list({
    search: needle,
    sort: 'name',
    page: { limit: 6 },
  });

  return page.items;
}
