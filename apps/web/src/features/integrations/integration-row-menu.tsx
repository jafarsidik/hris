'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { IntegrationSummary } from '@hris/shared-types';
import { ArrowUpRight, MoreHorizontalIcon, PencilLineIcon, Plug, Trash2 } from 'lucide-react';

/**
 * The per-row actions menu for the integrations list.
 *
 * Each action is gated by a permission flag passed from the screen, so a reader
 * only sees the actions they can perform. The destructive entry (Delete) is
 * separated and routes through the screen's `ConfirmDialog`.
 */
export function IntegrationRowMenu({
  integration,
  canManage,
  canUpdate,
  canDelete,
  testing,
  onOpen,
  onTest,
  onEdit,
  onDelete,
}: {
  readonly integration: IntegrationSummary;
  readonly canManage: boolean;
  readonly canUpdate: boolean;
  readonly canDelete: boolean;
  readonly testing: boolean;
  readonly onOpen: (integration: IntegrationSummary) => void;
  readonly onTest: (integration: IntegrationSummary) => void;
  readonly onEdit: (integration: IntegrationSummary) => void;
  readonly onDelete: (integration: IntegrationSummary) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${integration.name}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onOpen(integration)}>
          <ArrowUpRight aria-hidden="true" className="size-4" />
          Open
        </DropdownMenuItem>
        {canManage && (
          <DropdownMenuItem disabled={testing} onClick={() => onTest(integration)}>
            <Plug aria-hidden="true" className="size-4" />
            {testing ? 'Testing…' : 'Test'}
          </DropdownMenuItem>
        )}
        {canUpdate && (
          <DropdownMenuItem onClick={() => onEdit(integration)}>
            <PencilLineIcon aria-hidden="true" className="size-4" />
            Edit
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(integration)}>
              <Trash2 aria-hidden="true" className="size-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
