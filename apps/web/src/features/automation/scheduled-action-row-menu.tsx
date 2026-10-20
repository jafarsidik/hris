'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ScheduledActionSummary } from '@hris/shared-types';
import { MoreHorizontalIcon, Play, Power, Trash2 } from 'lucide-react';

/**
 * The per-row actions menu.
 *
 * The screen's previous controls were bare "Disable"/"Enable", "Run now" and "Delete"
 * buttons in the last column: they named no record, so a reader scanning a row had to
 * work out which action they belonged to, and the delete wrote on a single click with a
 * `window.confirm`. Moving them into a menu gives the actions an accessible name that
 * includes the action, and the delete routes through the screen's `ConfirmDialog`.
 */
export function ScheduledActionRowMenu({
  row,
  onToggle,
  onRunNow,
  onDelete,
}: {
  readonly row: ScheduledActionSummary;
  readonly onToggle: (row: ScheduledActionSummary) => void;
  readonly onRunNow: (id: string) => void;
  readonly onDelete: (row: ScheduledActionSummary) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${row.name}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onToggle(row)}>
          <Power aria-hidden="true" className="size-4" />
          {row.isEnabled ? 'Disable' : 'Enable'}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => onRunNow(row.id)}>
          <Play aria-hidden="true" className="size-4" />
          Run now
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onClick={() => onDelete(row)}>
          <Trash2 aria-hidden="true" className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
