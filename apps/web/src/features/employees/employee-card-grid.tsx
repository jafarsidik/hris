'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';

import { EmployeeStatusBadge } from './employee-status-badge';
import { initialsFor, formatHireDate } from './employee-presentation';
import type { Employee } from './employee-types';

/**
 * The directory's image-list presentation: one card per employee with the
 * avatar, the identity line and the same facts the table row carries. The
 * whole card opens the profile — the drawer's affordances stay available from
 * the table view, and a card is also a link so the middle-click keeps working.
 */
export function EmployeeCardGrid({ rows }: { rows: readonly Employee[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((row) => (
        <EmployeeCard key={row.id} employee={row} />
      ))}
    </div>
  );
}

function EmployeeCard({ employee }: { employee: Employee }) {
  const initials = initialsFor(employee.fullName);

  return (
    <Link
      href={`/employees/${employee.id}`}
      className={cn(
        'group flex flex-col gap-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10 transition-colors outline-none',
        'hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="flex items-center gap-3">
        {initials !== '' && (
          <div
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          >
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{employee.fullName}</div>
          <div className="text-xs tabular-nums text-muted-foreground">
            {employee.employeeNumber}
          </div>
        </div>
        <div className="shrink-0">
          <EmployeeStatusBadge status={employee.status} />
        </div>
      </div>

      <dl className="grid gap-2 text-xs">
        <div className="grid gap-0.5">
          <dt className="text-muted-foreground">Job title</dt>
          <dd className="truncate font-medium">{employee.jobTitle}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-muted-foreground">Department</dt>
          <dd className="truncate font-medium">{employee.department}</dd>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Type</dt>
            <dd className="truncate font-medium">{employee.employmentType}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Joined</dt>
            <dd className="truncate font-medium tabular-nums">
              {formatHireDate(employee.hireDate)}
            </dd>
          </div>
        </div>
      </dl>

      <div className="mt-auto">
        <span className="text-xs font-medium underline-offset-2 group-hover:underline">
          Open profile
        </span>
      </div>
    </Link>
  );
}
