'use client';

import * as React from 'react';

import { HrisDataTable, type DataTableColumn } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { describeStatus } from '@/features/employees/employee-presentation';
import type { Employee } from '@/features/employees/employee-types';
import { computeHeadcountFacts, type GroupCount } from './headcount-facts';

interface DepartmentRow {
  readonly id: string;
  readonly department: string;
  readonly count: number;
  readonly share: number;
}

interface EmploymentTypeRow {
  readonly id: string;
  readonly employmentType: string;
  readonly count: number;
  readonly share: number;
}

interface StatusRow {
  readonly id: string;
  readonly status: string;
  readonly count: number;
  readonly share: number;
}

function toDepartmentRows(groups: readonly GroupCount[]): readonly DepartmentRow[] {
  return groups.map((group) => ({
    id: group.key,
    department: group.key,
    count: group.count,
    share: group.share,
  }));
}

function toEmploymentTypeRows(groups: readonly GroupCount[]): readonly EmploymentTypeRow[] {
  return groups.map((group) => ({
    id: group.key,
    employmentType: group.key,
    count: group.count,
    share: group.share,
  }));
}

function toStatusRows(groups: readonly GroupCount[]): readonly StatusRow[] {
  return groups.map((group) => ({
    id: group.key,
    status: group.key,
    count: group.count,
    share: group.share,
  }));
}

function formatShare(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card>
      <CardHeader className="pb-1.5">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardDescription className="text-xs">{note}</CardDescription>
    </Card>
  );
}

function buildDepartmentColumns(): readonly DataTableColumn<DepartmentRow>[] {
  return [
    {
      id: 'department',
      header: 'Department',
      sortValue: (row) => row.department,
      cell: (row) => row.department,
    },
    {
      id: 'count',
      header: 'Headcount',
      align: 'right',
      sortValue: (row) => row.count,
      cellClassName: 'tabular-nums',
      cell: (row) => row.count,
    },
    {
      id: 'share',
      header: 'Share of total',
      align: 'right',
      sortValue: (row) => row.share,
      cellClassName: 'tabular-nums',
      cell: (row) => formatShare(row.share),
    },
  ];
}

function buildEmploymentTypeColumns(): readonly DataTableColumn<EmploymentTypeRow>[] {
  return [
    {
      id: 'type',
      header: 'Employment type',
      sortValue: (row) => row.employmentType,
      cell: (row) => row.employmentType,
    },
    {
      id: 'count',
      header: 'Headcount',
      align: 'right',
      sortValue: (row) => row.count,
      cellClassName: 'tabular-nums',
      cell: (row) => row.count,
    },
    {
      id: 'share',
      header: 'Share of total',
      align: 'right',
      sortValue: (row) => row.share,
      cellClassName: 'tabular-nums',
      cell: (row) => formatShare(row.share),
    },
  ];
}

function buildStatusColumns(): readonly DataTableColumn<StatusRow>[] {
  return [
    {
      id: 'status',
      header: 'Status',
      sortValue: (row) => row.status,
      cell: (row) => {
        const presentation = describeStatus(row.status);
        return (
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full ${
                presentation.variant === 'success'
                  ? 'bg-success'
                  : presentation.variant === 'warning'
                    ? 'bg-warning'
                    : presentation.variant === 'secondary'
                      ? 'bg-secondary'
                      : 'bg-muted-foreground'
              }`}
            />
            {presentation.label}
          </span>
        );
      },
    },
    {
      id: 'count',
      header: 'Headcount',
      align: 'right',
      sortValue: (row) => row.count,
      cellClassName: 'tabular-nums',
      cell: (row) => row.count,
    },
    {
      id: 'share',
      header: 'Share of total',
      align: 'right',
      sortValue: (row) => row.share,
      cellClassName: 'tabular-nums',
      cell: (row) => formatShare(row.share),
    },
  ];
}

/**
 * Headcount report: breakdown of the workforce by department, employment type
 * and status. All figures are derived from the employee rows the page loaded.
 */
export function HeadcountScreen({ initialRows }: { initialRows: readonly Employee[] }) {
  const facts = React.useMemo(() => computeHeadcountFacts(initialRows), [initialRows]);

  const departmentRows = React.useMemo(
    () => toDepartmentRows(facts.byDepartment),
    [facts.byDepartment],
  );
  const employmentTypeRows = React.useMemo(
    () => toEmploymentTypeRows(facts.byEmploymentType),
    [facts.byEmploymentType],
  );
  const statusRows = React.useMemo(() => toStatusRows(facts.byStatus), [facts.byStatus]);

  return (
    <PageBody>
      <PageHeader
        title="Headcount"
        description="Workforce breakdown by department, employment type and status."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total headcount" value={String(facts.total)} note="All employee records" />
        <Stat label="Active" value={String(facts.active)} note="Currently working" />
        <Stat label="On leave" value={String(facts.onLeave)} note="On leave right now" />
        <Stat label="Departments" value={String(facts.departments)} note="Distinct departments" />
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">By department</h2>
        <HrisDataTable
          rows={departmentRows}
          columns={buildDepartmentColumns()}
          selectable={false}
          pageSize={10}
          emptyTitle="No department data"
          emptyDescription="Departments appear once employees are loaded."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">By employment type</h2>
        <HrisDataTable
          rows={employmentTypeRows}
          columns={buildEmploymentTypeColumns()}
          selectable={false}
          pageSize={10}
          emptyTitle="No employment type data"
          emptyDescription="Employment types appear once employees are loaded."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">By status</h2>
        <HrisDataTable
          rows={statusRows}
          columns={buildStatusColumns()}
          selectable={false}
          pageSize={10}
          emptyTitle="No status data"
          emptyDescription="Statuses appear once employees are loaded."
        />
      </section>
    </PageBody>
  );
}
