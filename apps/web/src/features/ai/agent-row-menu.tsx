'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AiAgentSummary } from '@hris/shared-types';
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react';

/**
 * The per-row actions menu for agents.
 *
 * The screen's previous controls were bare "Edit" and "Delete" buttons in the last
 * column: they named no record, so a reader scanning a row had to work out which agent a
 * button belonged to, and "Delete" wrote straight through on a single click. Moving them
 * into a menu gives the trigger an accessible name that includes the agent, keeps the row
 * uncluttered, and — with `ConfirmDialog` on the screen — lets the destructive direction be
 * confirmed while the safe one stays a single click.
 *
 * Items are omitted entirely when the permission is absent, so a reader without
 * `ai.update` sees no Edit rather than a control that silently does nothing.
 */
export function AgentRowMenu({
  row,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
}: {
  readonly row: AiAgentSummary;
  readonly canUpdate: boolean;
  readonly canDelete: boolean;
  readonly onEdit: (row: AiAgentSummary) => void;
  readonly onDelete: (row: AiAgentSummary) => void;
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
        {canUpdate && (
          <DropdownMenuItem onClick={() => onEdit(row)}>
            <PencilIcon aria-hidden="true" className="size-4" />
            Edit
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(row)}>
            <Trash2Icon aria-hidden="true" className="size-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
