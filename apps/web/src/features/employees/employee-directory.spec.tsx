import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmployeeDirectory } from './employee-directory';
import type { Employee, EmployeePage } from './employee-types';

/**
 * The table is a client component, so the server action is mocked. Mocking it rather than
 * a route handler keeps these tests about rendering and interaction; the action's own
 * paging and validation behaviour is covered in `app/employees/actions.spec.ts`.
 */

const loadMoreEmployees = vi.hoisted(() => vi.fn());

vi.mock('@/app/employees/actions', () => ({ loadMoreEmployees }));

// Reset per test. Without it the shared spy accumulates calls, and an assertion that a
// request was never made passes or fails according to test order rather than behaviour.
beforeEach(() => {
  loadMoreEmployees.mockReset();
});

const FILTERS = { search: '', status: 'ALL', sort: 'name' as const };

const employee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'emp-0001',
  employeeNumber: 'EMP-0001',
  fullName: 'Amara Adeyemi',
  email: 'amara.adeyemi@example.com',
  jobTitle: 'Backend Engineer',
  department: 'Engineering',
  employmentType: 'Full time',
  hireDate: '2019-04-02',
  status: 'ACTIVE',
  ...overrides,
});

const page = (
  items: Employee[],
  overrides: Partial<EmployeePage['pageInfo']> = {},
): EmployeePage => ({
  items,
  pageInfo: { hasNextPage: false, endCursor: null, ...overrides },
});

describe('EmployeeDirectory', () => {
  it('renders a row per employee', () => {
    render(
      <EmployeeDirectory
        initialPage={page([employee(), employee({ id: 'emp-0002', fullName: 'Chen Silva' })])}
        filters={FILTERS}
      />,
    );

    expect(screen.getByText('Amara Adeyemi')).toBeInTheDocument();
    expect(screen.getByText('Chen Silva')).toBeInTheDocument();
  });

  it('labels the table columns', () => {
    render(<EmployeeDirectory initialPage={page([employee()])} filters={FILTERS} />);

    const header = screen.getByRole('table');

    for (const column of [
      'Name',
      'Employee no.',
      'Department',
      'Job title',
      'Hire date',
      'Status',
    ]) {
      expect(within(header).getByRole('columnheader', { name: column })).toBeInTheDocument();
    }
  });

  it('renders the row as a table row rather than a card', () => {
    render(<EmployeeDirectory initialPage={page([employee()])} filters={FILTERS} />);

    // A directory that stops being a table below some width is no longer scannable by
    // column, which is the main thing it is for.
    const row = screen.getByText('Amara Adeyemi').closest('tr');

    expect(row).not.toBeNull();
  });

  it('shows the count of loaded employees', () => {
    render(
      <EmployeeDirectory
        initialPage={page([employee(), employee({ id: 'emp-0002' })])}
        filters={FILTERS}
      />,
    );

    expect(screen.getByText('Showing 2 employees')).toBeInTheDocument();
  });

  it('uses the singular for one employee', () => {
    render(<EmployeeDirectory initialPage={page([employee()])} filters={FILTERS} />);

    expect(screen.getByText('Showing 1 employee')).toBeInTheDocument();
  });

  it('does not claim a total it cannot know', () => {
    render(
      <EmployeeDirectory
        initialPage={page([employee()], { hasNextPage: true, endCursor: 'c' })}
        filters={FILTERS}
      />,
    );

    // The endpoint returns no total, so any "of N" would be invented.
    expect(screen.getByText(/Showing 1 employee, more available/)).toBeInTheDocument();
    expect(screen.queryByText(/\bof \d+/)).not.toBeInTheDocument();
  });

  it('offers load more only when there is another page', () => {
    const { unmount } = render(
      <EmployeeDirectory
        initialPage={page([employee()], { hasNextPage: true, endCursor: 'c' })}
        filters={FILTERS}
      />,
    );
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
    unmount();

    render(<EmployeeDirectory initialPage={page([employee()])} filters={FILTERS} />);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('appends the next page without dropping what is already shown', async () => {
    loadMoreEmployees.mockResolvedValueOnce({
      ok: true,
      page: page([employee({ id: 'emp-0002', fullName: 'Chen Silva' })], {
        hasNextPage: false,
        endCursor: null,
      }),
    });

    render(
      <EmployeeDirectory
        initialPage={page([employee()], { hasNextPage: true, endCursor: 'cursor-1' })}
        filters={FILTERS}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Chen Silva')).toBeInTheDocument();
    // The first row must survive. Replacing the list on paging would lose the reader's
    // place without saying so.
    expect(screen.getByText('Amara Adeyemi')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 employees')).toBeInTheDocument();
  });

  it('sends the current cursor and filters with the request', async () => {
    loadMoreEmployees.mockResolvedValueOnce({ ok: true, page: page([]) });

    render(
      <EmployeeDirectory
        initialPage={page([employee()], { hasNextPage: true, endCursor: 'cursor-1' })}
        filters={{ search: 'amara', status: 'ACTIVE', sort: 'name' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    await screen.findByRole('button', { name: 'Load more' }).catch(() => undefined);
    expect(loadMoreEmployees).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'cursor-1', search: 'amara', status: 'ACTIVE' }),
    );
  });

  it('keeps the rows and explains the failure when the cursor is rejected', async () => {
    loadMoreEmployees.mockResolvedValueOnce({ ok: false, reason: 'INVALID_CURSOR' });

    render(
      <EmployeeDirectory
        initialPage={page([employee()], { hasNextPage: true, endCursor: 'stale' })}
        filters={FILTERS}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load the next page/i);
    // Blanking the table on a paging failure would destroy context the user still has.
    expect(screen.getByText('Amara Adeyemi')).toBeInTheDocument();
  });

  it('shows an empty state instead of an empty table', () => {
    render(<EmployeeDirectory initialPage={page([])} filters={FILTERS} />);

    expect(screen.getByText('No employees match these filters')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('offers a way out of the empty state', () => {
    render(<EmployeeDirectory initialPage={page([])} filters={FILTERS} />);

    expect(screen.getByRole('link', { name: /clear filters/i })).toHaveAttribute(
      'href',
      '/employees',
    );
  });

  it('renders an unrecognised status rather than hiding the row value', () => {
    render(
      <EmployeeDirectory
        initialPage={page([employee({ status: 'ON_PARENTAL_LEAVE' })])}
        filters={FILTERS}
      />,
    );

    expect(screen.getByText('ON_PARENTAL_LEAVE')).toBeInTheDocument();
  });

  it('makes the email actionable', () => {
    render(<EmployeeDirectory initialPage={page([employee()])} filters={FILTERS} />);

    expect(screen.getByRole('link', { name: 'amara.adeyemi@example.com' })).toHaveAttribute(
      'href',
      'mailto:amara.adeyemi@example.com',
    );
  });

  it('does not call the action without a cursor', () => {
    // `hasNextPage` and `endCursor` are supposed to agree; if they ever do not, the
    // button must not fire a request that cannot succeed.
    render(
      <EmployeeDirectory
        initialPage={page([employee()], { hasNextPage: true, endCursor: null })}
        filters={FILTERS}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(loadMoreEmployees).not.toHaveBeenCalled();
  });
});
