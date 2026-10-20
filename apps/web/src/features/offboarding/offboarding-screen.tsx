'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable, type DataTableColumn, type DataTableFilter } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';

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

const STATUS_OPTIONS = ['INITIATED', 'IN_CLEARANCE', 'CLEARED', 'COMPLETED'] as const;

/**
 * Offboarding: employee exit cases with clearance checklist progress.
 *
 * The list is passed as props from the server, so the table owns search, filtering,
 * sorting and pagination client-side.
 */
export function OffboardingScreen({ rows }: { rows: readonly OffboardingCase[] }) {
  const router = useRouter();
  const { state } = useSession();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const columns: readonly DataTableColumn<OffboardingCase>[] = [
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
      id: 'reason',
      header: 'Reason',
      sortValue: (row) => row.reason,
      cellClassName: 'max-w-[18rem] truncate text-sm',
      cell: (row) => row.reason,
    },
    {
      id: 'lastWorkingDate',
      header: 'Last working day',
      sortValue: (row) => row.lastWorkingDate,
      cellClassName: 'font-mono text-sm',
      cell: (row) => formatWhen(row.lastWorkingDate),
    },
    {
      id: 'checklist',
      header: 'Checklist',
      sortValue: (row) => row.checklistDone,
      align: 'center',
      cellClassName: 'font-mono text-sm',
      cell: (row) => `${row.checklistDone}/${row.checklistTotal}`,
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (row) => row.status,
      cell: (row) => statusBadge(row.status),
    },
  ];

  const filters: readonly DataTableFilter<OffboardingCase>[] = [
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
        title="Offboarding"
        description="Employee exit and separation cases with clearance checklists."
      />

      <HrisDataTable
        rows={rows}
        columns={columns}
        filters={filters}
        searchable
        searchText={(row) => `${row.employeeName} ${row.employeeNumber} ${row.reason}`}
        searchPlaceholder="Search cases…"
        selectable={false}
        emptyTitle="No offboarding cases yet"
        emptyDescription="Employee exit and separation cases appear here."
        noResultsTitle="No offboarding cases match this filter"
        noResultsDescription="Try a different search or status, or clear the filters to see every case."
      />
    </PageBody>
  );
}
