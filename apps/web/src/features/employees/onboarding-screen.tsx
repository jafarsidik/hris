'use client';

import * as React from 'react';

import { HrisDataTable, type DataTableColumn } from '@/components/data-table';
import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { EmployeeAvatar } from './employee-avatar';
import { formatApiHireDate } from './employee-presentation';
import type { ConfirmationStatus, OnboardingRow } from './onboarding-pipeline';

const CONFIRMATION_STATUS: Readonly<
  Record<ConfirmationStatus, { label: string; variant: 'warning' | 'secondary' | 'outline' }>
> = {
  'due-soon': { label: 'Due soon', variant: 'warning' },
  upcoming: { label: 'Upcoming', variant: 'secondary' },
  'not-applicable': { label: 'N/A', variant: 'outline' },
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-1.5">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function buildOnboardingColumns(): readonly DataTableColumn<OnboardingRow>[] {
  return [
    {
      id: 'employee',
      header: 'Employee',
      sortValue: (row) => row.employee.fullName,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <EmployeeAvatar employee={row.employee} />
          <div className="min-w-0">
            <span className="block truncate font-medium text-foreground">
              {row.employee.fullName}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {row.employee.employeeNumber}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'jobTitle',
      header: 'Job title',
      sortValue: (row) => row.employee.jobTitle,
      responsive: 'hidden lg:table-cell',
      cellClassName: 'max-w-[14rem]',
      cell: (row) => (
        <span className="block truncate" title={row.employee.jobTitle}>
          {row.employee.jobTitle}
        </span>
      ),
    },
    {
      id: 'department',
      header: 'Department',
      sortValue: (row) => row.employee.department,
      responsive: 'hidden lg:table-cell',
      cellClassName: 'max-w-[12rem]',
      cell: (row) => (
        <span className="block truncate" title={row.employee.department}>
          {row.employee.department}
        </span>
      ),
    },
    {
      id: 'employmentType',
      header: 'Type',
      sortValue: (row) => row.employee.employmentType,
      responsive: 'hidden xl:table-cell',
      cell: (row) => row.employee.employmentType,
    },
    {
      id: 'startDate',
      header: 'Start date',
      sortValue: (row) => row.employee.hireDate,
      responsive: 'hidden xl:table-cell',
      cellClassName: 'whitespace-nowrap tabular-nums',
      cell: (row) => formatApiHireDate(row.employee.hireDate),
    },
    {
      id: 'daysSinceStart',
      header: 'Days since start',
      sortValue: (row) => row.daysSinceStart,
      cellClassName: 'tabular-nums',
      cell: (row) => row.daysSinceStart,
    },
    {
      id: 'probationEnd',
      header: 'Probation end',
      sortValue: (row) => row.probationEnd,
      responsive: 'hidden xl:table-cell',
      cellClassName: 'whitespace-nowrap tabular-nums',
      cell: (row) => formatApiHireDate(row.probationEnd),
    },
    {
      id: 'confirmationStatus',
      header: 'Confirmation',
      sortValue: (row) => row.confirmationStatus,
      cell: (row) => {
        const status = CONFIRMATION_STATUS[row.confirmationStatus];
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
  ];
}

export function OnboardingScreen({
  rows,
  startingThisMonth,
  confirmationsDue30Days,
}: {
  rows: readonly OnboardingRow[];
  startingThisMonth: number;
  confirmationsDue30Days: number;
}) {
  const columns = React.useMemo(() => buildOnboardingColumns(), []);

  return (
    <PageBody>
      <PageHeader
        title="Onboarding"
        description="New employees and probationary staff in their confirmation window."
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <Stat label="In onboarding" value={String(rows.length)} />
        <Stat label="Starting this month" value={String(startingThisMonth)} />
        <Stat label="Confirmations due in 30 days" value={String(confirmationsDue30Days)} />
      </div>

      <HrisDataTable
        rows={rows}
        columns={columns}
        selectable={false}
        searchable
        searchText={(row) =>
          `${row.employee.fullName} ${row.employee.employeeNumber} ${row.employee.jobTitle} ${row.employee.department}`
        }
        searchPlaceholder="Search by name, number, title or department…"
        pageSize={25}
        status="ready"
        emptyTitle="No one is in the onboarding pipeline yet."
        emptyDescription="When employees join or enter probation they appear here."
        noResultsTitle="No one matches this search"
        noResultsDescription="Try a different search term."
      />
    </PageBody>
  );
}
