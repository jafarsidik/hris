'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { PageBody } from '@/components/layout/page-body';
import { EmptyState } from '@/components/feedback/empty-state';
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

import type { OffboardingCase } from './offboarding-types';

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function statusBadge(status: string) {
  switch (status) {
    case 'INITIATED':
      return <Badge variant="outline">Initiated</Badge>;
    case 'IN_CLEARANCE':
      return <Badge variant="warning">In clearance</Badge>;
    case 'CLEARED':
      return <Badge variant="secondary">Cleared</Badge>;
    case 'COMPLETED':
      return <Badge variant="success">Completed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/**
 * Offboarding: employee exit cases with clearance checklist progress.
 */
export function OffboardingScreen({ rows }: { rows: readonly OffboardingCase[] }) {
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
        title="Offboarding"
        description="Employee exit and separation cases with clearance checklists."
      />
      <Card>
        <CardHeader>
          <CardTitle>Exit cases</CardTitle>
          <CardDescription>{rows.length} case(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {' '}
          {rows.length === 0 ? (
            <EmptyState title="No offboarding cases yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Last working day</TableHead>
                  <TableHead className="text-center">Checklist</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{row.employeeNumber}</div>
                    </TableCell>
                    <TableCell className="max-w-[18rem] truncate text-sm">{row.reason}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatWhen(row.lastWorkingDate)}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {row.checklistDone}/{row.checklistTotal}
                    </TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
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
