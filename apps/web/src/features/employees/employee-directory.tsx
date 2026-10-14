'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  HrisDataTable,
  type DataTableBulkAction,
  type DataTableSortState,
  type FilterState,
} from '@/components/data-table';
import { ImportDialog } from '@/components/import/import-dialog';
import { EmployeeDetailDrawer } from '@/features/employees/employee-detail-drawer';
import { exportEmployeesToCsv } from '@/features/employees/employee-export';
import { AddEmployeeButton, EmployeeFormDialog } from '@/features/employees/employee-form-dialog';
import { importEmployeesFromCsv } from '@/features/employees/employee-import';
import {
  buildEmployeeColumns,
  EMPLOYEE_BUILT_IN_VIEWS,
  EMPLOYEE_FILTERS,
  EMPLOYEE_SEARCH_TEXT,
  EMPLOYEE_VIEWS_STORAGE_KEY,
} from '@/features/employees/employee-table-config';
import type { Employee } from '@/features/employees/employee-types';
import { Download, Upload } from 'lucide-react';

/**
 * The employee directory.
 *
 * Its job is pairing the shared {@link HrisDataTable} with the directory's own
 * affordances — the create/edit dialogs, the detail drawer, import, and the CSV export
 * of either the current rows or the selection. The candidate rows come pre-fetched from
 * the server page (a per-user, per-host source), so none of the interactive state on top
 * of the table needs a second round-trip: every filter, sort, page, view and selection
 * below plays out over the rows already in the browser.
 */
export function EmployeeDirectory({
  initialRows,
  initialFilters,
  initialSearch = '',
  initialSort,
  initialCreateOpen = false,
}: {
  initialRows: readonly Employee[];
  /** URL-derived, applied once; every change after first paint is the table's own. */
  initialFilters: FilterState;
  initialSearch?: string;
  initialSort?: DataTableSortState;
  /** Opens the create dialog on mount; the dashboard's "Add employee" uses this. */
  initialCreateOpen?: boolean;
}) {
  const { toast } = useToast();

  const [rows, setRows] = React.useState<readonly Employee[]>(initialRows);
  const [createOpen, setCreateOpen] = React.useState(initialCreateOpen);
  const [importOpen, setImportOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Employee | null>(null);
  const [viewing, setViewing] = React.useState<Employee | null>(null);

  const applySaved = (saved: Employee, mode: 'created' | 'updated') => {
    setRows((current) => {
      const index = current.findIndex((row) => row.id === saved.id);
      if (index === -1) return [...current, saved];
      if (mode === 'updated') {
        const next = [...current];
        next[index] = saved;
        return next;
      }
      return current;
    });
  };

  const exportAll = () => {
    exportEmployeesToCsv(rows);
    toast({
      title: 'Exported to CSV',
      description: `${rows.length} employee${rows.length === 1 ? '' : 's'} downloaded as sample data.`,
      variant: 'info',
    });
  };

  const bulkActions: readonly DataTableBulkAction<Employee>[] = [
    {
      id: 'export',
      label: 'Export',
      icon: Download,
      run: (selected, clearSelection) => {
        exportEmployeesToCsv(selected);
        toast({
          title: 'Exported to CSV',
          description: `${selected.length} selected employee${
            selected.length === 1 ? '' : 's'
          } downloaded.`,
          variant: 'info',
        });
        clearSelection();
      },
    },
    {
      id: 'change-status',
      label: 'Change status',
      disabled: true,
      disabledReason: 'bulk status changes are not wired to a backend in this build',
    },
    {
      id: 'assign-department',
      label: 'Assign department',
      disabled: true,
      disabledReason: 'bulk department changes are not wired to a backend in this build',
    },
  ];

  return (
    <>
      <HrisDataTable
        rows={rows}
        columns={buildEmployeeColumns({ onView: setViewing, onEdit: setEditing })}
        filters={EMPLOYEE_FILTERS}
        searchable
        searchText={EMPLOYEE_SEARCH_TEXT}
        searchPlaceholder="Search name, email, number…"
        initialFilters={initialFilters}
        initialSearch={initialSearch}
        defaultSort={initialSort}
        pageSize={25}
        bulkActions={bulkActions}
        views={{ builtIn: EMPLOYEE_BUILT_IN_VIEWS, storageKey: EMPLOYEE_VIEWS_STORAGE_KEY }}
        emptyTitle="No employees in the directory yet"
        emptyDescription="When rows are added they appear here, filterable, sortable and exportable."
        noResultsDescription="Try a different search or filter, or clear the filters to see everyone."
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload aria-hidden="true" className="size-3.5" />
              Import
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportAll}>
              <Download aria-hidden="true" className="size-3.5" />
              Export
            </Button>
            <AddEmployeeButton onClick={() => setCreateOpen(true)} />
          </>
        }
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import employees"
        description="Read a CSV of employees into the directory. The rows are read and counted here — nothing is written to a server yet."
        onImport={importEmployeesFromCsv}
        template={
          <>
            <p className="font-medium text-foreground">Expected columns</p>
            <p>
              Full name, Email, Job title, Department, Employment type, Hire date (YYYY-MM-DD),
              Status
            </p>
          </>
        }
      />

      <EmployeeFormDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={applySaved} />

      <EmployeeFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        employee={editing ?? undefined}
        onSaved={applySaved}
      />

      <EmployeeDetailDrawer
        employee={viewing}
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
        onEdit={(employee) => {
          setViewing(null);
          setEditing(employee);
        }}
      />
    </>
  );
}
