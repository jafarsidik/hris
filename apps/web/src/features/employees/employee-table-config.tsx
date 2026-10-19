import {
  EMPTY_FILTERS,
  ALL_ROWS_VIEW_STATE,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';

import { EmployeeAvatar } from './employee-avatar';
import { formatHireDate } from './employee-presentation';
import { EmployeeRowMenu } from './employee-row-menu';
import { EmployeeStatusBadge } from './employee-status-badge';
import type { Employee } from './employee-types';
import { EMPLOYEE_STATUSES } from './mock-employee-repository';

/**
 * The directory's table contract: what columns it shows, how it filters, and which
 * built-in views it offers. Kept apart from {@link EmployeeDirectory} so the generic
 * table config stays readable and the component stays about behaviour, not markup.
 */

export const EMPLOYEE_VIEWS_STORAGE_KEY = 'hris:employee-directory:views';

export const EMPLOYEE_SEARCH_TEXT = (employee: Employee): string =>
  `${employee.fullName} ${employee.email} ${employee.employeeNumber} ${employee.jobTitle} ${employee.department} ${employee.employmentType}`;

/**
 * The quick filters the toolbar shows, and the advanced ones under "More
 * filters", built from the directory rows in memory.
 *
 * The options are derived from the rows rather than a hard-coded vocabulary
 * because the data source is now the real API: the departments, employment
 * types and statuses that exist are what the company's data defines, and a
 * constant list could drift behind it.
 */
export function buildEmployeeFilters(
  rows: readonly Employee[],
): readonly DataTableFilter<Employee>[] {
  const uniqueSorted = (
    values: readonly (string | null)[],
  ): readonly { value: string; label: string }[] =>
    [...new Set(values.filter((value): value is string => value !== null && value !== ''))]
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: value }));

  const statuses = uniqueSorted([...EMPLOYEE_STATUSES, ...rows.map((employee) => employee.status)]);

  return [
    {
      kind: 'select',
      id: 'status',
      label: 'Status',
      placeholder: 'All statuses',
      getValue: (employee) => employee.status,
      options: statuses,
    },
    {
      kind: 'select',
      id: 'department',
      label: 'Department',
      placeholder: 'All departments',
      getValue: (employee) => employee.department,
      advanced: true,
      options: uniqueSorted(rows.map((employee) => employee.department)),
    },
    {
      kind: 'select',
      id: 'employmentType',
      label: 'Type',
      placeholder: 'All types',
      getValue: (employee) => employee.employmentType,
      advanced: true,
      options: uniqueSorted(rows.map((employee) => employee.employmentType)),
    },
    {
      kind: 'range',
      id: 'hireDate',
      label: 'Hire date',
      fromLabel: 'From',
      toLabel: 'To',
      getValue: (employee) => employee.hireDate,
    },
  ];
}

const withStatus = (status: string) => {
  const filters = { ...EMPTY_FILTERS, select: { status } };
  return { filters, search: '' };
};

const NEW_JOINERS_VIEW = {
  filters: EMPTY_FILTERS,
  search: '',
  sort: { columnId: 'hireDate', direction: 'desc' as const },
};

/** Views the directory ships with; the first is the default. */
export const EMPLOYEE_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All employees',
    builtIn: true,
    default: true,
    state: ALL_ROWS_VIEW_STATE,
  },
  { id: 'active', name: 'Active', builtIn: true, state: withStatus('ACTIVE') },
  { id: 'on-leave', name: 'On leave', builtIn: true, state: withStatus('ON_LEAVE') },
  { id: 'probation', name: 'Probation', builtIn: true, state: withStatus('PROBATION') },
  { id: 'new-joiners', name: 'New joiners', builtIn: true, state: NEW_JOINERS_VIEW },
];

/** The callbacks rows can trigger; owned by the directory, not the table. */
export interface EmployeeColumnHandlers {
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
}

export function buildEmployeeColumns({
  onView,
  onEdit,
}: EmployeeColumnHandlers): readonly DataTableColumn<Employee>[] {
  return [
    {
      id: 'name',
      header: 'Name',
      sortValue: (employee) => employee.fullName,
      cell: (employee) => (
        <div className="flex items-center gap-3">
          <EmployeeAvatar employee={employee} />
          <div className="min-w-0">
            <a
              href={`/employees/${employee.id}`}
              className="block truncate font-medium text-foreground underline-offset-2 hover:underline"
              title={employee.fullName}
            >
              {employee.fullName}
            </a>
            <a
              className="block truncate text-xs text-muted-foreground underline-offset-2 hover:underline sm:hidden"
              href={`/employees/${employee.id}`}
              title={employee.fullName}
            >
              {employee.employeeNumber} &middot; {employee.department}
            </a>
            <a
              className="hidden truncate text-xs text-muted-foreground underline-offset-2 hover:underline sm:block"
              href={`mailto:${employee.email}`}
              title={employee.email}
            >
              {employee.email}
            </a>
          </div>
        </div>
      ),
    },
    {
      id: 'employeeNumber',
      header: 'Employee no.',
      sortValue: (employee) => employee.employeeNumber,
      responsive: 'hidden md:table-cell',
      cellClassName: 'tabular-nums',
      cell: (employee) => employee.employeeNumber,
    },
    {
      id: 'department',
      header: 'Department',
      sortValue: (employee) => employee.department,
      responsive: 'hidden lg:table-cell',
      cellClassName: 'max-w-[12rem]',
      cell: (employee) => (
        <span className="block truncate" title={employee.department}>
          {employee.department}
        </span>
      ),
    },
    {
      id: 'jobTitle',
      header: 'Job title',
      sortValue: (employee) => employee.jobTitle,
      responsive: 'hidden lg:table-cell',
      cellClassName: 'max-w-[14rem]',
      cell: (employee) => (
        <span className="block truncate" title={employee.jobTitle}>
          {employee.jobTitle}
        </span>
      ),
    },
    {
      id: 'employmentType',
      header: 'Type',
      sortValue: (employee) => employee.employmentType,
      responsive: 'hidden xl:table-cell',
      cell: (employee) => employee.employmentType,
    },
    {
      id: 'hireDate',
      header: 'Hire date',
      sortValue: (employee) => employee.hireDate,
      responsive: 'hidden xl:table-cell',
      cellClassName: 'whitespace-nowrap tabular-nums',
      cell: (employee) => formatHireDate(employee.hireDate),
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (employee) => employee.status,
      cell: (employee) => <EmployeeStatusBadge status={employee.status} />,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      cellClassName: 'w-10 text-right',
      cell: (employee) => <EmployeeRowMenu employee={employee} onView={onView} onEdit={onEdit} />,
    },
  ];
}
