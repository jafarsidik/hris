'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontalIcon, PencilIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react';

import type { DeveloperApiClient } from './developer-types';

/**
 * The per-row actions menu for an API client.
 *
 * The screen's previous controls were four inline buttons in the last column: they named
 * no record, so a reader scanning a row had to work out which client the buttons belonged
 * to, and the destructive ones wrote on a single click. Moving them into a menu gives
 * every action an accessible name that includes the client, and lets the screen gate the
 * destructive ones behind a confirmation dialog.
 */
export function ClientRowMenu({
  client,
  canUpdate,
  canDelete,
  onEdit,
  onRotate,
  onToggleActive,
  onDelete,
}: {
  readonly client: DeveloperApiClient;
  readonly canUpdate: boolean;
  readonly canDelete: boolean;
  readonly onEdit: (client: DeveloperApiClient) => void;
  readonly onRotate: (client: DeveloperApiClient) => void;
  readonly onToggleActive: (client: DeveloperApiClient) => void;
  readonly onDelete: (client: DeveloperApiClient) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${client.name}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        {canUpdate && (
          <DropdownMenuItem onClick={() => onEdit(client)}>
            <PencilIcon aria-hidden="true" className="size-4" />
            Edit
          </DropdownMenuItem>
        )}
        {canUpdate && (
          <DropdownMenuItem onClick={() => onRotate(client)}>
            <RefreshCwIcon aria-hidden="true" className="size-4" />
            Rotate
          </DropdownMenuItem>
        )}
        {canUpdate && (
          <DropdownMenuItem onClick={() => onToggleActive(client)}>
            {client.isActive ? 'Disable' : 'Enable'}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(client)}>
            <Trash2Icon aria-hidden="true" className="size-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
