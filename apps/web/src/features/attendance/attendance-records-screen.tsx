'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

import type { AttendanceRecord } from './attendance-types';

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

const STATUS_OPTIONS = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE'] as const;

function statusBadge(status: string) {
  switch (status) {
    case 'PRESENT':
      return <Badge variant="success">Present</Badge>;
    case 'ABSENT':
      return <Badge variant="destructive">Absent</Badge>;
    case 'LATE':
      return <Badge variant="warning">Late</Badge>;
    case 'HALF_DAY':
      return <Badge variant="outline">Half day</Badge>;
    case 'ON_LEAVE':
      return <Badge variant="secondary">On leave</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/**
 * Attendance Records: daily employee clock-in/clock-out with status.
 */
export function AttendanceRecordsScreen({
  initialRows,
}: {
  initialRows: readonly AttendanceRecord[];
}) {
  const router = useRouter();
  const { state } = useSession();

  const [filterStatus, setFilterStatus] = useState<string>('');

  const filtered = initialRows.filter((row) => filterStatus === '' || row.status === filterStatus);

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const presentCount = filtered.filter((r) => r.status === 'PRESENT').length;
  const absentCount = filtered.filter((r) => r.status === 'ABSENT').length;
  const lateCount = filtered.filter((r) => r.status === 'LATE').length;

  return (
    <PageBody>
      <PageHeader
        title="Attendance"
        description="Daily employee attendance records — clock-in, clock-out and status."
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
        <Stat label="Records" value={String(filtered.length)} />
        <Stat label="Present" value={String(presentCount)} />
        <Stat label="Absent" value={String(absentCount)} />
        <Stat label="Late" value={String(lateCount)} />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attendance records found.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Records</CardTitle>
            <CardDescription>
              {filtered.length} attendance record{filtered.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center">Clock In</TableHead>
                  <TableHead className="text-center">Clock Out</TableHead>
                  <TableHead className="text-center">Break</TableHead>
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
                    <TableCell className="font-mono text-sm">
                      {formatWhen(row.attendanceDate)}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {row.clockIn ?? '—'}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {row.clockOut ?? '—'}
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">
                      {row.breakMinutes} min
                    </TableCell>
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
