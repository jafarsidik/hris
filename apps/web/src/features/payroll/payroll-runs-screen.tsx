'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { EmptyState } from '@/components/feedback/empty-state';
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

  return (
    <PageBody>
      <PageHeader
        title="Payroll"
        description="Payroll periods, salary structures and calculated runs."
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
            <CardDescription>{periods.length} period target(s) in the calendar</CardDescription>
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

      <Card>
        <CardHeader>
          <CardTitle>Payroll runs</CardTitle>
          <CardDescription>
            {filtered.length} run{filtered.length === 1 ? '' : 's'}
            {periodFilter !== '' ? ' in the selected period' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              title="No payroll runs match this view yet."
              description="Pick another period to see its runs."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Earnings</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{row.employeeNumber}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{row.periodCode}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatMoney(row.baseSalary)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatMoney(row.totalEarnings)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatMoney(row.totalDeductions)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatMoney(row.netPay)}
                    </TableCell>
                    <TableCell>{periodBadge(row.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
