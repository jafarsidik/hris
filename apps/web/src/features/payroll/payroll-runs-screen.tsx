'use client';

import { useEffect, useState } from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSession } from '@/features/auth/session-context';

import type { PayrollPeriod, PayrollRun } from './payroll-types';

const RUN_VIEWS_STORAGE_KEY = 'hris:payroll-runs:views';

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(amount);
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

const RUN_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'OPEN', label: 'Open' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CLOSED', label: 'Closed' },
];

const RUN_COLUMNS: readonly DataTableColumn<PayrollRun>[] = [
  {
    id: 'employee',
    header: 'Employee',
    sortValue: (row) => row.employeeName,
    cell: (row) => (
      <div>
        <div className="font-medium">{row.employeeName}</div>
        <div className="text-xs text-muted-foreground">{row.employeeNumber}</div>
      </div>
    ),
  },
  {
    id: 'period',
    header: 'Period',
    sortValue: (row) => row.periodCode,
    cellClassName: 'font-mono text-sm',
    cell: (row) => row.periodCode,
  },
  {
    id: 'base',
    header: 'Base',
    sortValue: (row) => row.baseSalary,
    align: 'right',
    cellClassName: 'font-mono text-sm',
    cell: (row) => formatMoney(row.baseSalary),
  },
  {
    id: 'earnings',
    header: 'Earnings',
    sortValue: (row) => row.totalEarnings,
    align: 'right',
    cellClassName: 'font-mono text-sm',
    cell: (row) => formatMoney(row.totalEarnings),
  },
  {
    id: 'deductions',
    header: 'Deductions',
    sortValue: (row) => row.totalDeductions,
    align: 'right',
    cellClassName: 'font-mono text-sm',
    cell: (row) => formatMoney(row.totalDeductions),
  },
  {
    id: 'netPay',
    header: 'Net pay',
    sortValue: (row) => row.netPay,
    align: 'right',
    cellClassName: 'font-mono text-sm',
    cell: (row) => formatMoney(row.netPay),
  },
  {
    id: 'status',
    header: 'Status',
    sortValue: (row) => row.status,
    cell: (row) => periodBadge(row.status),
  },
];

const RUN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All runs',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
];

/**
 * Payroll Runs: calculated payroll per employee per period, with the period
 * filter of the matching cycle.
 */
export function PayrollRunsScreen({
  initialRows,
  periods,
  salaryStructures,
}: {
  initialRows: readonly PayrollRun[];
  periods: readonly PayrollPeriod[];
  salaryStructures: readonly {
    readonly positionTitle: string;
    readonly baseSalary: number;
    readonly currency: string;
  }[];
}) {
  const router = useRouter();
  const { state } = useSession();

  const [periodFilter, setPeriodFilter] = useState<string>('');

  const filtered = initialRows.filter(
    (row) => periodFilter === '' || row.periodId === periodFilter,
  );

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const paidCount = filtered.filter((r) => r.status === 'PAID').length;
  const totalNet = filtered.reduce((sum, r) => sum + r.netPay, 0);

  const runStatusFilter: DataTableFilter<PayrollRun> = {
    kind: 'select',
    id: 'status',
    label: 'Status',
    placeholder: 'All statuses',
    getValue: (row) => row.status,
    options: RUN_STATUS_OPTIONS,
  };

  return (
    <PageBody>
      <PageHeader
        title="Payroll Runs"
        description="Payroll periods, salary structures and calculated runs."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1.5">
            <CardDescription>Runs</CardDescription>
            <CardTitle className="text-xl tabular-nums">{filtered.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1.5">
            <CardDescription>Paid</CardDescription>
            <CardTitle className="text-xl tabular-nums">{paidCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1.5">
            <CardDescription>Total net pay (filtered)</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatMoney(totalNet)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {periods.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Payroll periods</CardTitle>
            <CardDescription>
              {periods.length} period{periods.length === 1 ? '' : 's'} in the calendar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead>Pay date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-mono text-sm">{period.code}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatWhen(period.startDate)} – {formatWhen(period.endDate)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {period.payDate === null ? '—' : formatWhen(period.payDate)}
                    </TableCell>
                    <TableCell>{periodBadge(period.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/*
        The primary "Payroll runs" list used to be a bare `<table>` inside a `Card` with a
        period filter bolted into the page header. It now uses the shared table, which brings
        the toolbar, sorting, filters, column visibility, saved views and the empty /
        no-results states. The period filter stays screen-level state because the summary
        cards above read the same filtered set; it is handed to the table through the
        toolbar's `actions` slot so it lives with the other controls.
      */}
      <HrisDataTable
        rows={filtered}
        columns={RUN_COLUMNS}
        filters={[runStatusFilter]}
        searchable
        searchText={(row) => `${row.employeeName} ${row.employeeNumber} ${row.periodCode}`}
        searchPlaceholder="Search by employee, number or period…"
        selectable={false}
        views={{ builtIn: RUN_VIEWS, storageKey: RUN_VIEWS_STORAGE_KEY }}
        actions={
          <Select value={periodFilter} onValueChange={(value) => setPeriodFilter(value ?? '')}>
            <SelectTrigger className="w-48" aria-label="Filter by period">
              <SelectValue placeholder="All periods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" key="all">
                All periods
              </SelectItem>
              {periods.map((period) => (
                <SelectItem key={period.id} value={period.id}>
                  {period.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        status="ready"
        emptyTitle="No payroll runs match this view yet."
        emptyDescription="Pick another period to see its runs."
        noResultsTitle="No runs match this filter"
        noResultsDescription="Try a different search or status, or clear the filters to see every run."
      />

      {salaryStructures.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Salary structures</CardTitle>
            <CardDescription>Active base salaries by position</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead className="text-right">Base salary</TableHead>
                  <TableHead>Currency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryStructures.map((structure) => (
                  <TableRow key={structure.positionTitle}>
                    <TableCell className="font-medium">{structure.positionTitle}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatMoney(structure.baseSalary)}
                    </TableCell>
                    <TableCell>{structure.currency}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageBody>
  );
}
