'use client';

import * as React from 'react';
import { loadMoreEmployees } from '@/app/employees/actions';
import { EmptyState } from '@/components/feedback/empty-state';
import {
  describeStatus,
  formatHireDate,
  initialsFor,
} from '@/features/employees/employee-presentation';
import type { Employee, EmployeePage, EmployeeSort } from '@/features/employees/employee-types';
import { cn } from '@/lib/utils';
import { ColumnsIcon, RotateCcw, Users } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EmployeeDetailDrawer } from '@/features/employees/employee-detail-drawer';
import { AddEmployeeButton, EmployeeFormDialog } from '@/features/employees/employee-form-dialog';
import { exportEmployeesToCsv } from '@/features/employees/employee-export';
import { EmployeeRowMenu } from '@/features/employees/employee-row-menu';

const COLUMNS = [
  { key: 'department', label: 'Department', className: 'hidden lg:table-cell' },
  { key: 'jobTitle', label: 'Job title', className: 'hidden lg:table-cell' },
  { key: 'hireDate', label: 'Hire date', className: 'hidden xl:table-cell' },
] as const;

type ColumnKey = (typeof COLUMNS)[number]['key'];

/**
 * The employee table, with "load more" paging.
 *
 * Filters live in the URL and are applied by the server; this component owns the rows
 * the reader has paged in, plus the lightweight interactive surface on top: row
 * selection for bulk export, a column-visibility popover, per-row actions, and the
 * create/edit/view affordances. Saves land in the mock store, so the returned record is
 * merged straight into the local rows.
 */
export function EmployeeDirectory({
  initialPage,
  filters,
  initialCreateOpen = false,
}: {
  initialPage: EmployeePage;
  /** Echoed back to the action so a paged-in row always matches the current filter. */
  filters: { readonly search: string; readonly status: string; readonly sort: EmployeeSort };
  /** Opens the create dialog on mount; the dashboard's "Add employee" uses this. */
  initialCreateOpen?: boolean;
}) {
  const [rows, setRows] = useState<readonly Employee[]>(initialPage.items);
  const [hasNextPage, setHasNextPage] = useState(initialPage.pageInfo.hasNextPage);
  const [endCursor, setEndCursor] = useState(initialPage.pageInfo.endCursor);
  const [loadFailed, setLoadFailed] = useState(false);

  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [columns, setColumns] = useState<ReadonlySet<ColumnKey>>(
    new Set(COLUMNS.map((column) => column.key)),
  );

  const [createOpen, setCreateOpen] = useState(initialCreateOpen);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [viewing, setViewing] = useState<Employee | null>(null);

  const [isPending, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No employees match these filters"
        description="Adjust or clear the filters to see the rest of the directory."
        action={
          <Link href="/employees" className={cn(buttonVariants({ variant: 'outline' }))}>
            <RotateCcw aria-hidden="true" />
            Clear filters
          </Link>
        }
      />
    );
  }

  const loadMore = () => {
    if (endCursor === null || isPending) {
      return;
    }

    startTransition(async () => {
      const result = await loadMoreEmployees({
        cursor: endCursor,
        search: filters.search,
        status: filters.status,
        sort: filters.sort,
      });

      if (!result.ok) {
        setLoadFailed(true);
        return;
      }

      setRows((current) => [...current, ...result.page.items]);
      setHasNextPage(result.page.pageInfo.hasNextPage);
      setEndCursor(result.page.pageInfo.endCursor);
      setLoadFailed(false);
    });
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

  const allVisibleSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const someVisibleSelected = rows.some((row) => selected.has(row.id));

  const toggleAllVisible = () => {
    setSelected((current) => {
      const next = rows.some((row) => !current.has(row.id))
        ? new Set([...current, ...rows.map((row) => row.id)])
        : new Set([...current].filter((id) => !rows.some((row) => row.id === id)));
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Showing {rows.length} {rows.length === 1 ? 'employee' : 'employees'}
          {hasNextPage && ', more available'}
        </p>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
                />
              }
            >
              <ColumnsIcon aria-hidden="true" className="size-3.5" />
              Columns
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 p-2">
              <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
                Column visibility
              </p>
              {COLUMNS.map((column) => (
                <label
                  key={column.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={columns.has(column.key)}
                    onCheckedChange={(checked) => {
                      setColumns((current) => {
                        const next = new Set(current);
                        if (checked === true) next.add(column.key);
                        else next.delete(column.key);
                        return next;
                      });
                    }}
                  />
                  {column.label}
                </label>
              ))}
            </PopoverContent>
          </Popover>

          <AddEmployeeButton onClick={() => setCreateOpen(true)} />
        </div>
      </div>

      {selected.size > 0 && (
        <div
          role="toolbar"
          aria-label={`${selected.size} rows selected`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2"
        >
          <p className="text-sm font-medium tabular-nums">{selected.size} selected</p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportEmployeesToCsv(rows.filter((row) => selected.has(row.id)))}
            >
              Export
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled>
              Approve
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <Table containerClassName="max-h-[70vh] overflow-auto overscroll-contain">
          <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-4">
                <Checkbox
                  aria-label={allVisibleSelected ? 'Deselect all rows' : 'Select all rows'}
                  checked={allVisibleSelected}
                  onCheckedChange={toggleAllVisible}
                  indeterminate={!allVisibleSelected && someVisibleSelected}
                />
              </TableHead>
              <TableHead className="pl-2">Name</TableHead>
              <TableHead className="hidden md:table-cell">Employee no.</TableHead>
              {columns.has('department') && (
                <TableHead className={COLUMNS[0].className}>Department</TableHead>
              )}
              {columns.has('jobTitle') && (
                <TableHead className={COLUMNS[1].className}>Job title</TableHead>
              )}
              {columns.has('hireDate') && (
                <TableHead className={COLUMNS[2].className}>Hire date</TableHead>
              )}
              <TableHead className="pr-4">Status</TableHead>
              <TableHead className="w-10 pr-4" aria-label="Row actions" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((employee) => {
              const status = describeStatus(employee.status);
              const initials = initialsFor(employee.fullName);
              const isSelected = selected.has(employee.id);

              return (
                <TableRow
                  key={employee.id}
                  aria-selected={isSelected || undefined}
                  className={cn(isSelected && 'bg-primary/[0.04]')}
                >
                  <TableCell className="pl-4">
                    <Checkbox
                      aria-label={`Select ${employee.fullName}`}
                      checked={isSelected}
                      onCheckedChange={() => toggleRow(employee.id)}
                    />
                  </TableCell>

                  <TableCell className="max-w-[16rem] pl-2">
                    <div className="flex items-center gap-3">
                      {initials !== '' && (
                        <Avatar aria-hidden="true" className="size-8 shrink-0">
                          <AvatarFallback className="text-xs font-medium">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      )}

                      <div className="min-w-0">
                        <Link
                          href={`/employees/${employee.id}`}
                          className="block truncate font-medium underline-offset-2 hover:underline"
                          title={employee.fullName}
                        >
                          {employee.fullName}
                        </Link>
                        <span className="text-xs text-muted-foreground sm:hidden">
                          {employee.employeeNumber} &middot; {employee.department}
                        </span>
                        <a
                          className="hidden truncate text-xs text-muted-foreground underline-offset-2 hover:underline sm:block"
                          href={`mailto:${employee.email}`}
                          title={employee.email}
                        >
                          {employee.email}
                        </a>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="hidden md:table-cell tabular-nums">
                    {employee.employeeNumber}
                  </TableCell>

                  {columns.has('department') && (
                    <TableCell
                      className="hidden max-w-[12rem] truncate lg:table-cell"
                      title={employee.department}
                    >
                      {employee.department}
                    </TableCell>
                  )}
                  {columns.has('jobTitle') && (
                    <TableCell
                      className="hidden max-w-[14rem] truncate lg:table-cell"
                      title={employee.jobTitle}
                    >
                      {employee.jobTitle}
                    </TableCell>
                  )}
                  {columns.has('hireDate') && (
                    <TableCell className="hidden whitespace-nowrap tabular-nums xl:table-cell">
                      {formatHireDate(employee.hireDate)}
                    </TableCell>
                  )}

                  <TableCell className="pr-4">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>

                  <TableCell className="pr-4">
                    <EmployeeRowMenu employee={employee} onView={setViewing} onEdit={setEditing} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {loadFailed && (
        <p role="alert" className="text-sm text-destructive">
          Could not load the next page. The rows above are unchanged; reload the page to start over.
        </p>
      )}

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
    </div>
  );
}
