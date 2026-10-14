import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { installLocalStorageStub } from '@/test/local-storage-stub';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  ALL_ROWS_VIEW_STATE,
  EMPTY_FILTERS,
  HrisDataTable,
  type DataTableColumn,
  type DataTableFilter,
} from '.';

/**
 * Behavioural coverage for the shared table, over a small in-memory dataset. The table
 * is deliberately data-source-agnostic, so these tests speak in people, not employees:
 * any list — recruitment, attendance, payroll — must behave exactly this way.
 */

interface Person {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly status: string;
  readonly team: string;
}

const PEOPLE: readonly Person[] = [
  { id: '1', name: 'Zara', age: 30, status: 'ACTIVE', team: 'Eng' },
  { id: '2', name: 'Alicia', age: 25, status: 'ACTIVE', team: 'Eng' },
  { id: '3', name: 'Mario', age: 40, status: 'ON_LEAVE', team: 'Sales' },
  { id: '4', name: 'Bob', age: 22, status: 'PROBATION', team: 'Sales' },
];

const SEARCH_TEXT = (person: Person): string => `${person.name} ${person.team}`;

const COLUMNS: readonly DataTableColumn<Person>[] = [
  { id: 'name', header: 'Name', sortValue: (person) => person.name, cell: (person) => person.name },
  { id: 'age', header: 'Age', sortValue: (person) => person.age, cell: (person) => person.age },
  { id: 'status', header: 'Status', cell: (person) => person.status },
  { id: 'team', header: 'Team', cell: (person) => person.team },
];

const FILTERS: readonly DataTableFilter<Person>[] = [
  {
    kind: 'select',
    id: 'status',
    label: 'Status',
    placeholder: 'All statuses',
    getValue: (person) => person.status,
    options: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'ON_LEAVE', label: 'On leave' },
      { value: 'PROBATION', label: 'Probation' },
    ],
  },
  {
    kind: 'select',
    id: 'team',
    label: 'Team',
    placeholder: 'All teams',
    getValue: (person) => person.team,
    advanced: true,
    options: [
      { value: 'Eng', label: 'Engineering' },
      { value: 'Sales', label: 'Sales' },
    ],
  },
];

const VIEWS = {
  storageKey: 'hris:test:views',
  builtIn: [
    { id: 'all', name: 'Everyone', default: true, builtIn: true, state: ALL_ROWS_VIEW_STATE },
    {
      id: 'active',
      name: 'Active',
      builtIn: true,
      state: { filters: { select: { status: 'ACTIVE' }, ranges: {} }, search: '' } as const,
    },
  ],
};

function renderTable(overrides: Partial<Parameters<typeof HrisDataTable<Person>>[0]> = {}) {
  return render(
    <HrisDataTable
      rows={PEOPLE}
      columns={COLUMNS}
      filters={FILTERS}
      searchText={SEARCH_TEXT}
      defaultSort={{ columnId: 'name', direction: 'asc' }}
      views={VIEWS}
      {...overrides}
    />,
  );
}

describe('HrisDataTable', () => {
  beforeEach(() => {
    installLocalStorageStub();
  });

  it('renders a row per record', () => {
    renderTable();

    expect(screen.getByText('Zara')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('filters rows by free text', () => {
    renderTable();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search table' }), {
      target: { value: 'zara' },
    });

    expect(screen.getByText('Zara')).toBeInTheDocument();
    expect(screen.queryByText('Alicia')).not.toBeInTheDocument();
  });

  it('matches search text against joined fields, not just one', () => {
    renderTable();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search table' }), {
      target: { value: 'sales' },
    });

    expect(screen.getByText('Mario')).toBeInTheDocument();
    expect(screen.queryByText('Zara')).not.toBeInTheDocument();
  });

  it('explains an empty search result and clears it', () => {
    renderTable();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search table' }), {
      target: { value: 'nobody' },
    });

    expect(screen.getByText('Nothing matches your search or filters')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByText('Zara')).toBeInTheDocument();
  });

  it('shows an empty state when there are no rows at all', () => {
    renderTable({ rows: [] });

    expect(screen.getByText('No rows yet')).toBeInTheDocument();
  });

  it('sorts a column and flips its direction', () => {
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: /sort by age?/i }), undefined);
    fireEvent.click(screen.getByRole('button', { name: /sort by age, ascending?/i }), undefined);

    // Two clicks on "Age" = descending: 40, 30, 25, 22, so Mario leads.
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Mario');
  });

  it('pages over the rows it holds', () => {
    renderTable({ pageSize: 2 });

    expect(screen.getByText(/1–2 of 4/)).toBeInTheDocument();
    // Default sort is name-ascending, so page one starts at Alicia.
    expect(screen.getByText('Alicia')).toBeInTheDocument();
    expect(screen.queryByText('Zara')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));

    expect(screen.getByText(/3–4 of 4/)).toBeInTheDocument();
    expect(screen.getByText('Zara')).toBeInTheDocument();
  });

  it('selects rows and reports a count', () => {
    renderTable();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select 1' }));

    expect(screen.getByRole('toolbar', { name: '1 rows selected' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select this page' }));

    expect(screen.getByRole('toolbar', { name: '4 rows selected' })).toBeInTheDocument();
  });

  it('keeps the selection across pages', async () => {
    renderTable({ pageSize: 2 });

    // Default sort is name-ascending, so page one is Alicia (id 2) and Bob (id 4).
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));

    expect(screen.getByRole('toolbar', { name: '1 rows selected' })).toBeInTheDocument();
  });

  it('hides a column from the Columns menu', async () => {
    renderTable();

    expect(screen.getByRole('columnheader', { name: 'Team' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /columns/i }));

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Show team column' }));

    expect(screen.queryByRole('columnheader', { name: 'Team' })).not.toBeInTheDocument();
    expect(screen.queryByText('Eng')).not.toBeInTheDocument();
  });

  it('narrows via a quick filter and shows a removable chip', async () => {
    renderTable();

    fireEvent.click(screen.getByRole('combobox', { name: /filter by status/i }));

    const option = await screen.findByRole('option', { name: 'Active' });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.click(option);

    await waitFor(() => expect(screen.queryByText('Mario')).not.toBeInTheDocument());
    expect(screen.getByText('Zara')).toBeInTheDocument();

    // One chip explains the narrowing, and removing it widens again.
    expect(await screen.findByText('Status: Active')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /remove status: active filter/i }));

    await waitFor(() => expect(screen.getByText('Mario')).toBeInTheDocument());
  });

  it('applies a built-in view from the Views menu', () => {
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: /views/i }));

    fireEvent.click(screen.getByRole('menuitemradio', { name: /active/i }));

    expect(screen.getByText('Zara')).toBeInTheDocument();
    expect(screen.queryByText('Mario')).not.toBeInTheDocument();
    expect(screen.getByText('Status: Active')).toBeInTheDocument();
  });

  it('applies an advanced filter from the More filters surface', async () => {
    renderTable();

    fireEvent.click(screen.getByRole('button', { name: /more filters/i }));

    fireEvent.click(await screen.findByRole('combobox', { name: 'Team' }));
    const teamOption = await screen.findByRole('option', { name: 'Engineering' });
    fireEvent.pointerDown(teamOption, { pointerType: 'mouse' });
    fireEvent.click(teamOption);
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => expect(screen.queryByText('Bob')).not.toBeInTheDocument());
    expect(screen.getByText('Zara')).toBeInTheDocument();
    expect(await screen.findByText('Team: Engineering')).toBeInTheDocument();
  });

  it('rejects filters that prove nothing (the empty filter object is inert)', () => {
    renderTable({ initialFilters: EMPTY_FILTERS });

    expect(screen.getByText('Zara')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('honours the initial filters a deep link hands it', () => {
    renderTable({
      initialFilters: {
        select: { status: 'ON_LEAVE' },
        ranges: {},
      },
    });

    expect(screen.getByText('Mario')).toBeInTheDocument();
    expect(screen.queryByText('Zara')).not.toBeInTheDocument();
  });
});
