'use client';

import * as React from 'react';

import { HrisDataTable, type DataTableColumn } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Employee } from '@/features/employees/employee-types';
import { computeTurnoverFacts } from './turnover-facts';

interface DepartmentRow {
  readonly id: string;
  readonly department: string;
  readonly total: number;
  readonly exits: number;
  readonly rate: number;
}

interface ReasonRow {
  readonly id: string;
  readonly reason: string;
  readonly count: number;
}

function toDepartmentRows(
  groups: readonly {
    key: string;
    total: number;
    exits: number;
    rate: number;
  }[],
): readonly DepartmentRow[] {
  return groups.map((group) => ({
    id: group.key,
    department: group.key,
    total: group.total,
    exits: group.exits,
    rate: group.rate,
  }));
}

function toReasonRows(groups: readonly { key: string; count: number }[]): readonly ReasonRow[] {
  return groups.map((group) => ({
    id: group.key,
    reason: group.key,
    count: group.count,
  }));
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
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
      id: 'total',
      header: 'Headcount',
      align: 'right',
      sortValue: (row) => row.total,
      cellClassName: 'tabular-nums',
      cell: (row) => row.total,
    },
    {
      id: 'exits',
      header: 'Exits',
      align: 'right',
      sortValue: (row) => row.exits,
      cellClassName: 'tabular-nums',
      cell: (row) => row.exits,
    },
    {
      id: 'rate',
      header: 'Attrition rate',
      align: 'right',
      sortValue: (row) => row.rate,
      cellClassName: 'tabular-nums',
      cell: (row) => formatRate(row.rate),
    },
  ];
}

function buildReasonColumns(): readonly DataTableColumn<ReasonRow>[] {
  return [
    {
      id: 'reason',
      header: 'Exit reason',
      sortValue: (row) => row.reason,
      cell: (row) => row.reason,
    },
    {
      id: 'count',
      header: 'Cases',
      align: 'right',
      sortValue: (row) => row.count,
      cellClassName: 'tabular-nums',
      cell: (row) => row.count,
    },
  ];
}

/**
 * Employee Turnover report: attrition derived from live employee data.
 *
 * Exit rule: TERMINATED and INACTIVE are the terminal exit states. The
 * attrition rate denominator is total headcount (all employee records).
 *
 * The exit-reason breakdown uses the mock offboarding repository. Not every
 * exit has an offboarding case, so the reason table covers only those that do.
 * Tenure at exit is omitted: the employee record carries a hire date but no
 * termination date, so the figure cannot be derived without inventing data.
 */
export function TurnoverScreen({
  employees,
  exitReasons,
}: {
  employees: readonly Employee[];
  exitReasons: readonly { reason: string }[];
}) {
  const facts = React.useMemo(
    () => computeTurnoverFacts(employees, exitReasons),
    [employees, exitReasons],
  );

  const departmentRows = React.useMemo(
    () => toDepartmentRows(facts.byDepartment),
    [facts.byDepartment],
  );
  const reasonRows = React.useMemo(() => toReasonRows(facts.byReason), [facts.byReason]);

  return (
    <PageBody>
      <PageHeader
        title="Employee Turnover"
        description="Attrition derived from live employee data. Exit rule: TERMINATED and INACTIVE are terminal exit states. Data source: live employee records plus demo offboarding cases."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total headcount"
          value={String(facts.totalHeadcount)}
          note="All employee records"
        />
        <Stat label="Active" value={String(facts.activeHeadcount)} note="Non-exit statuses" />
        <Stat label="Exits" value={String(facts.exits)} note="TERMINATED + INACTIVE" />
        <Stat
          label="Attrition rate"
          value={formatRate(facts.attritionRate)}
          note="Exits / total headcount"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Attrition by department</h2>
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
        <h2 className="text-base font-semibold">Exits by reason</h2>
        <HrisDataTable
          rows={reasonRows}
          columns={buildReasonColumns()}
          selectable={false}
          pageSize={10}
          emptyTitle="No exit reasons"
          emptyDescription="Reasons appear once offboarding cases are loaded."
        />
      </section>
    </PageBody>
  );
}
