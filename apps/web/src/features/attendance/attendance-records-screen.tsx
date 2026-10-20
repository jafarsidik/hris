'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable, type DataTableColumn, type DataTableFilter } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { useSession } from '@/features/auth/session-context';

import type { AttendanceRecord } from './attendance-types';

function formatWhen(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

/**
 * Clock-in and clock-out are instants, and were being printed raw: the column read
 * `2026-10-18T08:00:00Z` next to a `Date` column that said "Oct 18, 2026".
 *
 * Pinned to UTC deliberately, for two reasons. The stored value is a wall-clock time —
 * the seeded records are 08:00–17:00 with a 60-minute break, i.e. a working day, not a
 * timestamp to be shifted into the reader's zone (a UTC+7 reader would otherwise be shown
 * clocking in at 15:00). And the table is server-rendered, so formatting in the reader's
 * zone would make the container (UTC) and the browser disagree — the hydration mismatch
 * `employee-presentation.dateFormat` documents at length.
 */
const clockFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

function formatClock(value: string | null): string {
  if (value === null || value === '') {
    return '—';
  }

  const parsed = new Date(value);

  // An unparseable instant is shown as it arrived rather than as "Invalid Date", the same
  // rule the employee presentation layer applies to a malformed date.
  return Number.isNaN(parsed.getTime()) ? value : clockFormat.format(parsed);
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
 *
 * The list is server-rendered with the full dataset passed as props, so the table owns
 * search, filtering, sorting and pagination client-side. The status filter that used to
 * sit in the page header is now a table filter, and the stat cards above reflect the
 * full dataset rather than the current filter — they are summary widgets, and the
 * filtered view lives in the table below.
 */
export function AttendanceRecordsScreen({
  initialRows,
}: {
  initialRows: readonly AttendanceRecord[];
}) {
  const router = useRouter();
  const { state } = useSession();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const presentCount = initialRows.filter((r) => r.status === 'PRESENT').length;
  const absentCount = initialRows.filter((r) => r.status === 'ABSENT').length;
  const lateCount = initialRows.filter((r) => r.status === 'LATE').length;

  const columns: readonly DataTableColumn<AttendanceRecord>[] = [
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
      id: 'date',
      header: 'Date',
      sortValue: (row) => row.attendanceDate,
      cellClassName: 'font-mono text-sm',
      cell: (row) => formatWhen(row.attendanceDate),
    },
    {
      id: 'clockIn',
      header: 'Clock In',
      sortValue: (row) => row.clockIn ?? '',
      align: 'center',
      cellClassName: 'font-mono text-sm',
      cell: (row) => formatClock(row.clockIn),
    },
    {
      id: 'clockOut',
      header: 'Clock Out',
      sortValue: (row) => row.clockOut ?? '',
      align: 'center',
      cellClassName: 'font-mono text-sm',
      cell: (row) => formatClock(row.clockOut),
    },
    {
      id: 'break',
      header: 'Break',
      sortValue: (row) => row.breakMinutes,
      align: 'center',
      cellClassName: 'font-mono text-sm',
      cell: (row) => `${row.breakMinutes} min`,
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (row) => row.status,
      cell: (row) => statusBadge(row.status),
    },
  ];

  const filters: readonly DataTableFilter<AttendanceRecord>[] = [
    {
      kind: 'select',
      id: 'status',
      label: 'Status',
      placeholder: 'All statuses',
      getValue: (row) => row.status,
      options: STATUS_OPTIONS.map((status) => ({ value: status, label: status })),
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Attendance"
        description="Daily employee attendance records — clock-in, clock-out and status."
      />

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 mb-4">
        <Stat label="Records" value={String(initialRows.length)} />
        <Stat label="Present" value={String(presentCount)} />
        <Stat label="Absent" value={String(absentCount)} />
        <Stat label="Late" value={String(lateCount)} />
      </div>

      <HrisDataTable
        rows={initialRows}
        columns={columns}
        filters={filters}
        searchable
        searchText={(row) => `${row.employeeName} ${row.employeeNumber}`}
        searchPlaceholder="Search by employee…"
        selectable={false}
        emptyTitle="No attendance records yet"
        emptyDescription="Daily clock-in, clock-out and status records appear here."
        noResultsTitle="No attendance records match this view yet."
        noResultsDescription="Adjust the filters to see records."
      />
    </PageBody>
  );
}
