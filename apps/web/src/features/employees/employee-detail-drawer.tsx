'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  describeStatus,
  formatHireDate,
  initialsFor,
} from '@/features/employees/employee-presentation';
import type { Employee } from '@/features/employees/employee-types';
import { Building2, Mail, PencilLine } from 'lucide-react';

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

/**
 * Quick-view drawer for a single employee.
 *
 * A sheet rather than a whole page: HR spending a day in the directory needs to glance
 * at a record and hop back to the list, and a modal would block the context behind it.
 * Rows stay non-clickable in the table; the row menu's "View" opens this.
 */
export function EmployeeDetailDrawer({
  employee,
  open,
  onOpenChange,
  onEdit,
}: {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (employee: Employee) => void;
}) {
  const initials = employee === null ? '' : initialsFor(employee.fullName);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Employee</SheetTitle>
          <SheetDescription>
            Quick look at the record; edit opens the same form the list uses.
          </SheetDescription>
        </SheetHeader>

        {employee !== null && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {initials !== '' ? (
                  <Avatar aria-hidden="true" className="size-11 shrink-0">
                    <AvatarFallback className="text-sm font-medium">{initials}</AvatarFallback>
                  </Avatar>
                ) : null}
                <div className="min-w-0">
                  <p className="truncate font-medium">{employee.fullName}</p>
                  <p className="truncate text-sm text-muted-foreground">{employee.jobTitle}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {employee.employeeNumber}
                  </p>
                </div>
              </div>
              <Badge variant={describeStatus(employee.status).variant}>
                {describeStatus(employee.status).label}
              </Badge>
            </div>

            <div className="flex">
              <Button type="button" variant="outline" size="sm" onClick={() => onEdit(employee)}>
                <PencilLine aria-hidden="true" className="size-3.5" />
                Edit
              </Button>
            </div>

            <dl className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
              <DetailRow label="Department">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 aria-hidden="true" className="size-3.5 text-muted-foreground" />
                  {employee.department}
                </span>
              </DetailRow>
              <DetailRow label="Job title">{employee.jobTitle}</DetailRow>
              <DetailRow label="Employment type">{employee.employmentType}</DetailRow>
              <DetailRow label="Join date">{formatHireDate(employee.hireDate)}</DetailRow>
              <DetailRow label="Email">
                <a
                  className="inline-flex items-center gap-1.5 text-primary underline-offset-2 hover:underline"
                  href={`mailto:${employee.email}`}
                >
                  <Mail aria-hidden="true" className="size-3.5" />
                  {employee.email}
                </a>
              </DetailRow>
            </dl>

            <p className="text-xs text-muted-foreground">
              Headcount and location fields land with the core HR endpoint. This record is served by
              the mock source and resets on restart.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
