'use client';

import * as React from 'react';

import { HrisDataTable, type DataTableColumn } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { EmployeeMovementSummary } from '@hris/shared-types';
import { computeMovementFacts } from './movement-facts';

interface TypeRow {
  readonly id: string;
  readonly type: string;
  readonly count: number;
}

interface MonthRow {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

interface UnitRow {
  readonly id: string;
  readonly unit: string;
  readonly count: number;
}

function toTypeRows(groups: readonly { key: string; count: number }[]): readonly TypeRow[] {
  return groups.map((group) => ({
    id: group.key,
    type: group.key,
    count: group.count,
  }));
}

function toMonthRows(
  groups: readonly { key: string; label: string; count: number }[],
): readonly MonthRow[] {
  return groups.map((group) => ({
    id: group.key,
    label: group.label,
    count: group.count,
  }));
}

function toUnitRows(groups: readonly { key: string; count: number }[]): readonly UnitRow[] {
  return groups.map((group) => ({
    id: group.key,
    unit: group.key,
    count: group.count,
  }));
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

function buildTypeColumns(): readonly DataTableColumn<TypeRow>[] {
  return [
    {
      id: 'type',
      header: 'Movement type',
      sortValue: (row) => row.type,
      cell: (row) => row.type,
    },
    {
      id: 'count',
      header: 'Count',
      align: 'right',
      sortValue: (row) => row.count,
      cellClassName: 'tabular-nums',
      cell: (row) => row.count,
    },
  ];
}

function buildMonthColumns(): readonly DataTableColumn<MonthRow>[] {
  return [
    {
      id: 'month',
      header: 'Month',
      sortValue: (row) => row.label,
      cell: (row) => row.label,
    },
    {
      id: 'count',
      header: 'Movements',
      align: 'right',
      sortValue: (row) => row.count,
      cellClassName: 'tabular-nums',
      cell: (row) => row.count,
    },
  ];
}

function buildUnitColumns(): readonly DataTableColumn<UnitRow>[] {
  return [
    {
      id: 'unit',
      header: 'Destination unit',
      sortValue: (row) => row.unit,
      cell: (row) => row.unit,
    },
    {
      id: 'count',
      header: 'Movements',
      align: 'right',
      sortValue: (row) => row.count,
      cellClassName: 'tabular-nums',
      cell: (row) => row.count,
    },
  ];
}

/**
 * Employee Movement report: aggregated view of organizational movement over
 * time, by type, by month and by destination unit.
 *
 * The dataset behind this screen is the demo movement set that ships with the
 * employment module (`mockMovements`). A real movements endpoint will replace
 * it; the screen itself is production-ready.
 */
export function MovementScreen({ movements }: { movements: readonly EmployeeMovementSummary[] }) {
  const facts = React.useMemo(() => computeMovementFacts(movements), [movements]);

  const typeRows = React.useMemo(() => toTypeRows(facts.byType), [facts.byType]);
  const monthRows = React.useMemo(() => toMonthRows(facts.byMonth), [facts.byMonth]);
  const unitRows = React.useMemo(
    () => toUnitRows(facts.byDestinationUnit),
    [facts.byDestinationUnit],
  );

  return (
    <PageBody>
      <PageHeader
        title="Employee Movement"
        description="Organizational movement over time: transfers, promotions and role changes aggregated by type, month and destination unit. Data source: demo movement dataset."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total movements" value={String(facts.total)} note="All recorded movements" />
        <Stat label="This year" value={String(facts.thisYear)} note="Effective in current year" />
        <Stat
          label="This month"
          value={String(facts.thisMonth)}
          note="Effective in current month"
        />
        <Stat
          label="Movement types"
          value={String(facts.byType.length)}
          note="Distinct types recorded"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Movements by type</h2>
        <HrisDataTable
          rows={typeRows}
          columns={buildTypeColumns()}
          selectable={false}
          pageSize={10}
          emptyTitle="No movement type data"
          emptyDescription="Types appear once movements are loaded."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Movements by month</h2>
        <HrisDataTable
          rows={monthRows}
          columns={buildMonthColumns()}
          selectable={false}
          pageSize={12}
          emptyTitle="No monthly data"
          emptyDescription="Monthly breakdown appears once movements are loaded."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Movements by destination unit</h2>
        <HrisDataTable
          rows={unitRows}
          columns={buildUnitColumns()}
          selectable={false}
          pageSize={10}
          emptyTitle="No unit data"
          emptyDescription="Destination units appear once movements are loaded."
        />
      </section>
    </PageBody>
  );
}
