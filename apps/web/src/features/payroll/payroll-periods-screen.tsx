'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useSession } from '@/features/auth/session-context';

import type { PayrollPeriod } from './payroll-types';

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
      <Card>
        <CardHeader>
          <CardTitle>Periods</CardTitle>
          <CardDescription>
            {rows.length} period{rows.length === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payroll periods defined yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead>Pay date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-mono text-sm">{period.code}</TableCell>
                    <TableCell className="font-medium">{period.name}</TableCell>
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
          )}
        </CardContent>
      </Card>
    </PageBody>
  );
}
