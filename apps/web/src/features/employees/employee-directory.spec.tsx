import { fireEvent, render, screen, within } from '@testing-library/react';
import { EMPTY_FILTERS } from '@/components/data-table';
import { ToastProvider } from '@/components/ui/toast';
import { installLocalStorageStub } from '@/test/local-storage-stub';
import { beforeEach, describe, expect, it } from 'vitest';

import { EmployeeDirectory } from './employee-directory';
import type { Employee } from './employee-types';

/**
 * The directory is a pure client component over rows the server page already fetched:
 * there is no action to mock, and the workspace root test setup's `server-only` stub
 * keeps the directory's imports (which never touch `server-only`) honest. These tests
 * pin the interaction surface the table hands back to this page — filtering, paging and
 * selection over the in-browser window — while the generic table's own behaviours are
 * covered in the data-table spec.
 */

let employeeCounter = 0;

function employee(overrides: Partial<Employee> = {}): Employee {
  employeeCounter += 1;
  const sequence = String(employeeCounter).padStart(4, '0');
  return {
    id: `emp-${sequence}`,
    employeeNumber: `EMP-${sequence}`,
    fullName: `Employee ${employeeCounter}`,
    email: `employee${employeeCounter}@example.com`,
    jobTitle: 'Backend Engineer',
    department: 'Engineering',
    employmentType: 'Full time',
    hireDate: '2019-04-02',
    status: 'ACTIVE',
    ...overrides,
  };
}

function renderDirectory(
  rows: readonly Employee[],
  overrides: Partial<{
    initialFilters: typeof EMPTY_FILTERS;
    initialSearch: string;
  }> = {},
) {
  return render(
    <ToastProvider>
      <EmployeeDirectory
        initialRows={rows}
        initialFilters={overrides.initialFilters ?? EMPTY_FILTERS}
        initialSearch={overrides.initialSearch ?? ''}
      />
    </ToastProvider>,
  );
}

const thirtyEmployees = Array.from({ length: 30 }, (_, index) =>
  employee({ id: `emp-${String(index + 1).padStart(4, '0')}`, fullName: `Employee ${index + 1}` }),
);

describe('EmployeeDirectory', () => {
  beforeEach(() => {
    installLocalStorageStub();
    employeeCounter = 0;
  });

  it('renders a row per employee', () => {
    renderDirectory([
      employee({ fullName: 'Amara Adeyemi' }),
      employee({ fullName: 'Chen Silva' }),
    ]);

    expect(screen.getByText('Amara Adeyemi')).toBeInTheDocument();
    expect(screen.getByText('Chen Silva')).toBeInTheDocument();
  });

  it('labels the table columns', () => {
    renderDirectory([employee()]);

    const header = screen.getByRole('table');

    for (const column of [
      'Name',
      'Employee no.',
      'Department',
      'Job title',
      'Type',
      'Hire date',
      'Status',
    ]) {
      expect(within(header).getByRole('columnheader', { name: column })).toBeInTheDocument();
    }
  });

  it('renders the row as a table row rather than a card', () => {
    renderDirectory([employee({ fullName: 'Amara Adeyemi' })]);

    expect(screen.getByText('Amara Adeyemi').closest('tr')).not.toBeNull();
  });

  it('paginates over the rows already on the client', () => {
    renderDirectory(thirtyEmployees);

    expect(screen.getByText(/1–25 of 30/)).toBeInTheDocument();
    expect(screen.getByText('Employee 1')).toBeInTheDocument();
    expect(screen.queryByText('Employee 26')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));

    expect(screen.getByText(/26–30 of 30/)).toBeInTheDocument();
    expect(screen.getByText('Employee 26')).toBeInTheDocument();
    expect(screen.queryByText('Employee 1')).not.toBeInTheDocument();
  });

  it('filters by search without a server round-trip', () => {
    renderDirectory([
      employee({ fullName: 'Amara Adeyemi' }),
      employee({ fullName: 'Chen Silva' }),
    ]);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search table' }), {
      target: { value: 'amara' },
    });

    expect(screen.getByText('Amara Adeyemi')).toBeInTheDocument();
    expect(screen.queryByText('Chen Silva')).not.toBeInTheDocument();
  });

  it('explains a search that matches nothing and offers a way out', () => {
    renderDirectory([employee({ fullName: 'Amara Adeyemi' })]);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search table' }), {
      target: { value: 'nobody-has-this-name' },
    });

    expect(screen.getByText('Nothing matches your search or filters')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByText('Amara Adeyemi')).toBeInTheDocument();
  });

  it('shows an empty state instead of an empty table', () => {
    renderDirectory([]);

    expect(screen.getByText('No employees in the directory yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows honest bread-and-butter actions in the bulk bar', () => {
    renderDirectory([employee()]);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select emp-0001' }));

    const bulkBar = screen.getByRole('toolbar', { name: '1 rows selected' });
    expect(within(bulkBar).getByText('1 selected')).toBeInTheDocument();

    const exportButton = within(bulkBar).getByRole('button', { name: 'Export' });
    expect(exportButton).toBeEnabled();

    // Disabled bulk actions must say why, not just be greyed out.
    const changeStatus = within(bulkBar).getByRole('button', { name: /change status/i });
    expect(changeStatus).toBeDisabled();
    expect(changeStatus).toHaveAccessibleName(/not wired to a backend/i);

    const assignDepartment = within(bulkBar).getByRole('button', { name: /assign department/i });
    expect(assignDepartment).toBeDisabled();
  });

  it('clears the selection from the bulk bar', () => {
    renderDirectory([employee()]);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select emp-0001' }));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
  });

  it('selects every row on the page from the header', () => {
    renderDirectory([employee(), employee(), employee()]);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select this page' }));

    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('means the selection survives a page change', () => {
    renderDirectory(thirtyEmployees);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select emp-0001' }));
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));

    // The count is still there, because selection spans pages.
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('offers the import surface from the toolbar', () => {
    renderDirectory([employee()]);

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(screen.getByText('Import employees')).toBeInTheDocument();
    expect(screen.getByText(/drag a CSV here/i)).toBeInTheDocument();
  });

  it('offers an add-employee control straight from the toolbar', () => {
    renderDirectory([employee()]);

    expect(screen.getByRole('button', { name: /add employee/i })).toBeInTheDocument();
  });

  it('renders an unrecognised status rather than hiding the row value', () => {
    renderDirectory([employee({ status: 'ON_PARENTAL_LEAVE' })]);

    expect(screen.getByText('ON_PARENTAL_LEAVE')).toBeInTheDocument();
  });

  it('makes the email actionable', () => {
    renderDirectory([employee({ email: 'amara.adeyemi@example.com', fullName: 'Amara Adeyemi' })]);

    expect(screen.getByRole('link', { name: 'amara.adeyemi@example.com' })).toHaveAttribute(
      'href',
      'mailto:amara.adeyemi@example.com',
    );
  });

  it('keeps the directory looking like a directory when a name is long', () => {
    renderDirectory([
      employee({
        fullName: 'Alejandra Sofia del Carmen Rodriguez Hernandez',
        id: 'emp-0001',
      }),
    ]);

    expect(screen.getByText('Alejandra Sofia del Carmen Rodriguez Hernandez')).toBeInTheDocument();
  });
});
