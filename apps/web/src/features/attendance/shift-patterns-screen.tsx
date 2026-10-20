'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable, type DataTableColumn } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';

import { useSession } from '@/features/auth/session-context';

import type { ShiftPattern } from './attendance-types';
import { timeLabel, workDaysLabel } from './shift-pattern-data';

/**
 * Shift Patterns: reusable shift definitions the roster is built from —
 * start/end times, break length and the days each pattern covers.
 *
 * The list is passed as props from the server, so the table owns search, sorting and
 * pagination client-side.
 */
export function ShiftPatternsScreen({ rows }: { rows: readonly ShiftPattern[] }) {
  const router = useRouter();
  const { state } = useSession();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const columns: readonly DataTableColumn<ShiftPattern>[] = [
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
      cell: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          <div className="text-xs text-muted-foreground">{row.description ?? ''}</div>
        </div>
      ),
    },
    {
      id: 'hours',
      header: 'Hours',
      sortValue: (row) => row.startTime,
      cellClassName: 'font-mono text-sm',
      cell: (row) => `${timeLabel(row.startTime)} – ${timeLabel(row.endTime)}`,
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
      id: 'workDays',
      header: 'Work days',
      sortValue: (row) => row.workDays,
      cellClassName: 'text-sm',
      cell: (row) => workDaysLabel(row.workDays),
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (row) => (row.isActive ? 'Active' : 'Inactive'),
      cell: (row) =>
        row.isActive ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="outline">Inactive</Badge>
        ),
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Shift Patterns"
        description="Reusable shift definitions — hours, break and covered days."
      />

      <HrisDataTable
        rows={rows}
        columns={columns}
        searchable
        searchText={(row) => `${row.code} ${row.name} ${row.description ?? ''}`}
        searchPlaceholder="Search shift patterns…"
        selectable={false}
        emptyTitle="No shift patterns defined yet"
        emptyDescription="Shift patterns created for the roster appear here."
        noResultsTitle="No shift patterns match this filter"
        noResultsDescription="Try a different search, or clear the filters to see every pattern."
      />
    </PageBody>
  );
}
