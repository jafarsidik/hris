'use client';

import * as React from 'react';

import { HrisDataTable } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';

import { EmployeeCardGrid } from './employee-card-grid';
import { EmployeeDirectoryKpis } from './employee-directory-kpis';
import {
  buildEmployeeColumns,
  buildEmployeeFilters,
  EMPLOYEE_BUILT_IN_VIEWS,
  EMPLOYEE_SEARCH_TEXT,
  EMPLOYEE_VIEWS_STORAGE_KEY,
} from './employee-table-config';
import type { Employee } from './employee-types';

/**
 * The card-grid browse view of the employee directory.
 *
 * Shares the same data source, filters, search and KPI strip as the table
 * directory at `/employees`, but presents the rows as a card grid instead of a
 * table. The shared `HrisDataTable` owns the search, filter, sort and pagination
 * state; this component only chooses the presentation.
 */
export function EmployeeDirectoryBrowse({ initialRows }: { initialRows: readonly Employee[] }) {
  const rows = React.useMemo(() => initialRows, [initialRows]);
  const filters = React.useMemo(() => buildEmployeeFilters(rows), [rows]);
  const columns = React.useMemo(
    () => buildEmployeeColumns({ onView: () => {}, onEdit: () => {} }),
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Employee Directory"
        description="Browse the workforce as a card grid. Search, filter and sort to find people."
      />

      <EmployeeDirectoryKpis rows={rows} />

      <HrisDataTable
        rows={rows}
        columns={columns}
        filters={filters}
        searchable
        searchText={EMPLOYEE_SEARCH_TEXT}
        searchPlaceholder="Search name, email, number…"
        pageSize={25}
        selectable={false}
        views={{
          builtIn: EMPLOYEE_BUILT_IN_VIEWS,
          storageKey: EMPLOYEE_VIEWS_STORAGE_KEY,
        }}
        presentationBody={(pagedRows) => <EmployeeCardGrid rows={pagedRows} />}
        status="ready"
        emptyTitle="No employees in the directory yet"
        emptyDescription="When rows are added they appear here as cards."
        noResultsDescription="Try a different search or filter, or clear the filters to see everyone."
      />
    </PageBody>
  );
}
