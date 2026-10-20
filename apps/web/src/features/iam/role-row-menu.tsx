'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RoleSummary } from './iam-types';
import { MoreHorizontalIcon, PencilLineIcon, Trash2 } from 'lucide-react';

/**
 * The per-row actions menu.
 *
 * Deleting a role was previously reachable only from inside the permission editor, which
 * meant the reader had to open the thing they were about to remove — and then the deletion
 * happened on a single click with no confirmation. Both are fixed here: the action is on the
 * row it applies to, and it routes through the screen's `ConfirmDialog`.
 *
 * A system role's delete entry is disabled rather than hidden. The API refuses it, and a
 * missing entry looks like an oversight while a disabled one that the reader can see says
 * the platform is deliberately keeping it.
 */
export function RoleRowMenu({
  role,
  onOpen,
  onDelete,
}: {
  readonly role: RoleSummary;
  readonly onOpen: (role: RoleSummary) => void;
  readonly onDelete: (role: RoleSummary) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${role.name}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onOpen(role)}>
          <PencilLineIcon aria-hidden="true" className="size-4" />
          Edit permissions
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={role.isSystem}
          onClick={() => onDelete(role)}
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Delete role
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
