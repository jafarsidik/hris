'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import {
  HrisDataTable,
  EMPTY_FILTERS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/features/auth/session-context';

import type { PayrollPeriod } from './payroll-types';

const PERIOD_VIEWS_STORAGE_KEY = 'hris:payroll-periods:views';

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function periodBadge(status: string) {
  switch (status) {
    case 'DRAFT':
      return <Badge variant="outline">Draft</Badge>;
    case 'OPEN':
      return <Badge variant="secondary">Open</Badge>;
    case 'PROCESSING':
      return <Badge variant="warning">Processing</Badge>;
    case 'APPROVED':
      return <Badge variant="success">Approved</Badge>;
    case 'PAID':
      return <Badge variant="success">Paid</Badge>;
    case 'CLOSED':
      return <Badge variant="outline">Closed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

const PERIOD_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'OPEN', label: 'Open' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CLOSED', label: 'Closed' },
];

const PERIOD_COLUMNS: readonly DataTableColumn<PayrollPeriod>[] = [
  {
    id: 'code',
    header: 'Code',
    sortValue: (row) => row.code,
    cellClassName: 'font-mono text-sm',
    cell: (row) => row.code,
  },
  {
    id: 'name',
    header: 'Name',
    sortValue: (row) => row.name,
    cellClassName: 'font-medium',
    cell: (row) => row.name,
  },
  {
    id: 'range',
    header: 'Range',
    sortValue: (row) => row.startDate,
    cellClassName: 'font-mono text-sm',
    cell: (row) => `${formatWhen(row.startDate)} – ${formatWhen(row.endDate)}`,
  },
  {
    id: 'payDate',
    header: 'Pay date',
    sortValue: (row) => row.payDate ?? '',
    cellClassName: 'font-mono text-sm',
    cell: (row) => (row.payDate === null ? '—' : formatWhen(row.payDate)),
  },
  {
    id: 'status',
    header: 'Status',
    sortValue: (row) => row.status,
    cell: (row) => periodBadge(row.status),
  },
];

const PERIOD_FILTERS: readonly DataTableFilter<PayrollPeriod>[] = [
  {
    kind: 'select',
    id: 'status',
    label: 'Status',
    placeholder: 'All statuses',
    getValue: (row) => row.status,
    options: PERIOD_STATUS_OPTIONS,
  },
];

const PERIOD_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All periods',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
];

/**
 * Payroll Periods: the pay period calendar and its lifecycle status.
 */
export function PayrollPeriodsScreen({ rows }: { rows: readonly PayrollPeriod[] }) {
  const router = useRouter();
  const { state } = useSession();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  return (
    <PageBody>
      <PageHeader
        title="Payroll Periods"
        description="Pay period calendar with lifecycle from draft to locked."
      />

      {/*
        The periods list used to be a bare `<table>` inside a `Card` with no search, no sort
        and no way to hide a column. It now uses the shared table, which brings the toolbar,
        sorting, filters, column visibility, saved views and the empty/no-results states.
      */}
      <HrisDataTable
        rows={rows}
        columns={PERIOD_COLUMNS}
        filters={PERIOD_FILTERS}
        searchable
        searchText={(row) => `${row.code} ${row.name}`}
        searchPlaceholder="Search by code or name…"
        selectable={false}
        views={{ builtIn: PERIOD_VIEWS, storageKey: PERIOD_VIEWS_STORAGE_KEY }}
        status="ready"
        emptyTitle="No payroll periods defined yet"
        emptyDescription="Pay periods appear here once they are created."
        noResultsTitle="No period matches this filter"
        noResultsDescription="Try a different search or status, or clear the filters to see every period."
      />
    </PageBody>
  );
}
