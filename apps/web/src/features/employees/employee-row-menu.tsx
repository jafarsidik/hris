'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportEmployeesToCsv } from '@/features/employees/employee-export';
import type { Employee } from '@/features/employees/employee-types';
import {
  DownloadIcon,
  EyeIcon,
  ExternalLinkIcon,
  MailIcon,
  MoreHorizontalIcon,
  PencilLineIcon,
} from 'lucide-react';
import Link from 'next/link';

/**
 * The per-row actions menu.
 *
 * Rendering the kebab on every row is the only way a mouse-and-keyboard user can act on
 * a single row without a click-through to the detail page. Rows themselves stay
 * non-clickable so the whole surface does not quiver when someone selects a row for
 * bulk work; the name cell links to the full profile instead.
 */
export function EmployeeRowMenu({
  employee,
  onView,
  onEdit,
}: {
  employee: Employee;
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${employee.fullName}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem render={<Link href={`/employees/${employee.id}`} />}>
          <ExternalLinkIcon aria-hidden="true" className="size-4" />
          Open profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onView(employee)}>
          <EyeIcon aria-hidden="true" className="size-4" />
          View profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(employee)}>
          <PencilLineIcon aria-hidden="true" className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportEmployeesToCsv([employee])}>
          <DownloadIcon aria-hidden="true" className="size-4" />
          Export as CSV
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => window.location.assign(`mailto:${employee.email}`)}>
          <MailIcon aria-hidden="true" className="size-4" />
          Email
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
