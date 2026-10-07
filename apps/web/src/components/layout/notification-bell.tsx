'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BellIcon } from 'lucide-react';

/**
 * The notification bell in the header.
 *
 * Nothing in the platform emits notifications yet, so the popover states that plainly
 * instead of showing a fake inbox. Keeping the button itself functional — the dropdown
 * does open — means the shell has the real affordance in place before the events
 * (workflows, approvals, payroll calendar) that will fill it exist.
 */
export function NotificationBell() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Notifications"
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
          />
        }
      >
        <BellIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-3 py-6 text-center">
          <BellIcon aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">You&apos;re all caught up</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Workflow, approval and payroll alerts will land here as modules ship.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
