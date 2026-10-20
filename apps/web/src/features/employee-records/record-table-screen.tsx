'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { HrisDataTable, type DataTableColumn } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';

import { useSession } from '@/features/auth/session-context';

export interface RecordRowView {
  readonly id: string;
  readonly employeeName: string;
  /** Shown under the name; omit for non-employee lists. */
  readonly employeeNumber?: string;
  /** Rendered cell values (strings), matching `columns`. */
  readonly cells: readonly string[];
}

export interface RecordTableParams {
  readonly title: string;
  readonly description: string;
  readonly columns: readonly string[];
  readonly rows: readonly RecordRowView[];
  /** Label of the first column; the row's name (and sub-line) sit under it. */
  readonly firstColumn?: string;
}

/**
 * Generic employee sub-record table used by the Employee Data screens
 * (family, dependents, contacts, education, experience, skills,
 * certifications, documents). Each page pre-shapes its records into
 * string cells so one type-safe table serves all of them.
 *
 * The rows are a pure client-side dataset — passed in as props — so the
 * shared table's own search, sort and pagination apply directly.
 */
export function RecordTableScreen({ table }: { table: RecordTableParams }) {
  const router = useRouter();
  const { state } = useSession();

  useEffect(() => {
    if (state.status === 'anonymous') {
      router.replace('/login');
    }
  }, [state.status, router]);

  const columns: readonly DataTableColumn<RecordRowView>[] = [
    {
      id: 'name',
      header: table.firstColumn ?? 'Employee',
      sortValue: (row) => row.employeeName,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.employeeName}</span>
          {row.employeeNumber === undefined ? null : (
            <span className="text-xs text-muted-foreground">{row.employeeNumber}</span>
          )}
        </div>
      ),
    },
    ...table.columns.map((column, index) => ({
      id: `cell-${index}`,
      header: column,
      sortValue: (row: RecordRowView) => row.cells[index] ?? '',
      cellClassName: 'text-sm',
      cell: (row: RecordRowView) => {
        const value = row.cells[index] ?? '';
        return value === '' ? '—' : value;
      },
    })),
  ];

  return (
    <PageBody>
      <PageHeader title={table.title} description={table.description} />
      <HrisDataTable
        rows={table.rows}
        columns={columns}
        searchable
        searchText={(row) =>
          `${row.employeeName} ${row.employeeNumber ?? ''} ${row.cells.join(' ')}`
        }
        searchPlaceholder="Search records…"
        selectable={false}
        status="ready"
        emptyTitle="No records yet"
        emptyDescription="Records appear here once they are added."
        noResultsTitle="No records match this filter"
        noResultsDescription="Try a different search, or clear the filters to see every record."
      />
    </PageBody>
  );
}
