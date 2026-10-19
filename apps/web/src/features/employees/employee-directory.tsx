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
  buildEmployeeFilters,
  EMPLOYEE_BUILT_IN_VIEWS,
  EMPLOYEE_SEARCH_TEXT,
  EMPLOYEE_VIEWS_STORAGE_KEY,
} from '@/features/employees/employee-table-config';
import type { Employee } from '@/features/employees/employee-types';
import { EmployeeCardGrid } from '@/features/employees/employee-card-grid';
import { EmployeeDirectoryKpis } from '@/features/employees/employee-directory-kpis';
import { LayoutGrid, Table2, Download, Upload } from 'lucide-react';

/** The persisted table/cards presentation choice for this browser. */
const PRESENTATION_STORAGE_KEY = 'hris:employee-directory:presentation';

/**
 * The Table / Photo list switch. It lives inside the data table's toolbar —
 * level with the search and filter controls, like the reference screen — so it
 * survives the presentation switch: one toolbar serves both.
 */
function PresentationToggle({
  presentation,
  onSwitch,
}: {
  presentation: 'table' | 'cards';
  onSwitch: (next: 'table' | 'cards') => void;
}) {
  return (
    <div
      role="group"
      aria-label="Directory view"
      className="inline-flex overflow-hidden rounded-lg ring-1 ring-foreground/10"
    >
      <Button
        type="button"
        aria-pressed={presentation === 'table'}
        size="sm"
        onClick={() => onSwitch('table')}
      >
        <Table2 aria-hidden="true" className="size-3.5" />
        Table
      </Button>
      <Button
        type="button"
        aria-pressed={presentation === 'cards'}
        size="sm"
        onClick={() => onSwitch('cards')}
      >
        <LayoutGrid aria-hidden="true" className="size-3.5" />
        Photo list
      </Button>
    </div>
  );
}

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
  units,
  positions,
}: {
  initialRows: readonly Employee[];
  /** URL-derived, applied once; every change after first paint is the table's own. */
  initialFilters: FilterState;
  initialSearch?: string;
  initialSort?: DataTableSortState;
  /** Opens the create dialog on mount; the dashboard's "Add employee" uses this. */
  initialCreateOpen?: boolean;
  /** Real placement vocabulary from the API; absent means free-text fallback. */
  units?: readonly { readonly id: string; readonly name: string }[];
  positions?: readonly {
    readonly id: string;
    readonly name: string;
    readonly unitId: string | null;
  }[];
}) {
  const { toast } = useToast();

  const [rows, setRows] = React.useState<readonly Employee[]>(initialRows);
  const [createOpen, setCreateOpen] = React.useState(initialCreateOpen);
  const [importOpen, setImportOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Employee | null>(null);
  const [viewing, setViewing] = React.useState<Employee | null>(null);
  /*
   * Table first, image list on demand. The choice persists per browser like the
   * saved column views do; it is presentation only and never touches the query.
   * The switch itself rides inside the data table's toolbar (the `actions`
   * slot), so search and filters stay level with it and shared by both views.
   */
  const [presentation, setPresentation] = React.useState<'table' | 'cards'>('table');

  React.useEffect(() => {
    const saved = window.localStorage.getItem(PRESENTATION_STORAGE_KEY);
    if (saved === 'cards' || saved === 'table') {
      setPresentation(saved);
    }
  }, []);

  const switchPresentation = (next: 'table' | 'cards') => {
    setPresentation(next);
    try {
      window.localStorage.setItem(PRESENTATION_STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable; the in-memory choice still applies.
    }
  };

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

  const filters = React.useMemo(() => buildEmployeeFilters(rows), [rows]);

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

  const directoryActions = (
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
  );

  return (
    <>
      {/*
        Header row above both presentations: the write actions (Import,
        Export, Add) never move when the view flips.
      */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Directory</h1>
        <div className="flex items-center gap-2">{directoryActions}</div>
      </div>

      {/* Summary strip: total, active, on leave, recent — the reference screen's KPI cards. */}
      <EmployeeDirectoryKpis rows={rows} activeStatus={initialFilters.select.status} />

      {/*
        One table renderer serves both presentations: the toolbar (search,
        filters, chips) plus pagination stays mounted, the toggle sits level
        with the filter section, and the row area either shows the table or the
        image-list cards for the very same filtered, sorted, paged rows.
      */}
      <HrisDataTable
        rows={rows}
        columns={buildEmployeeColumns({ onView: setViewing, onEdit: setEditing })}
        filters={filters}
        searchable
        searchText={EMPLOYEE_SEARCH_TEXT}
        searchPlaceholder="Search name, email, number…"
        initialFilters={initialFilters}
        initialSearch={initialSearch}
        defaultSort={initialSort}
        pageSize={25}
        bulkActions={bulkActions}
        views={{ builtIn: EMPLOYEE_BUILT_IN_VIEWS, storageKey: EMPLOYEE_VIEWS_STORAGE_KEY }}
        actions={<PresentationToggle presentation={presentation} onSwitch={switchPresentation} />}
        presentationBody={
          presentation === 'cards'
            ? (pagedRows) => <EmployeeCardGrid rows={pagedRows} />
            : undefined
        }
        emptyTitle="No employees in the directory yet"
        emptyDescription="When rows are added they appear here, filterable, sortable and exportable."
        noResultsDescription="Try a different search or filter, or clear the filters to see everyone."
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

      <EmployeeFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={applySaved}
        units={units}
        positions={positions}
      />

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
