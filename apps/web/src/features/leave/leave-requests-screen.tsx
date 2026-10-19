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

import type { LeaveRequest } from './leave-types';

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-1.5">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;

function statusBadge(status: string) {
  switch (status) {
    case 'PENDING':
      return <Badge variant="warning">Pending</Badge>;
    case 'APPROVED':
      return <Badge variant="success">Approved</Badge>;
    case 'REJECTED':
      return <Badge variant="destructive">Rejected</Badge>;
    case 'CANCELLED':
      return <Badge variant="secondary">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/**
 * Leave Requests: employee leave applications and their approval status.
 *
 * Receives the first page of rows from the server page; filtering happens
 * client-side over the rows in hand.
 */
export function LeaveRequestsScreen({ initialRows }: { initialRows: readonly LeaveRequest[] }) {
  const router = useRouter();
  const { state } = useSession();

  const [filterStatus, setFilterStatus] = useState<string>('');

  const filtered = initialRows.filter((row) => filterStatus === '' || row.status === filterStatus);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const pendingCount = filtered.filter((r) => r.status === 'PENDING').length;
  const approvedCount = filtered.filter((r) => r.status === 'APPROVED').length;

  return (
    <PageBody>
      <PageHeader
        title="Leave Requests"
        description="Employee leave applications and their approval status."
        actions={
          <Select
            value={filterStatus}
            onValueChange={(value) => setFilterStatus((value ?? '') as string)}
          >
            <SelectTrigger className="w-40" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" key="all">
                All statuses
              </SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 mb-4">
        <Stat label="Requests" value={String(filtered.length)} />
        <Stat label="Pending" value={String(pendingCount)} />
        <Stat label="Approved" value={String(approvedCount)} />
        <Stat label="Days requested" value={String(filtered.reduce((sum, r) => sum + r.days, 0))} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No leave requests match this view yet."
          description="Try a different status filter."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Requests</CardTitle>
            <CardDescription>
              {filtered.length} leave request{filtered.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave type</TableHead>
                  <TableHead className="text-center">From → To</TableHead>
                  <TableHead className="text-center">Days</TableHead>
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
                    <TableCell className="font-mono text-sm">{row.leaveTypeName}</TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {formatWhen(row.startDate)} → {formatWhen(row.endDate)}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">{row.days}</TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
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
