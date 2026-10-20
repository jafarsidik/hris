'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UserSummary } from './iam-types';
import { MoreHorizontalIcon, UserCheckIcon, UserXIcon } from 'lucide-react';

/**
 * The per-row actions menu.
 *
 * The screen's previous control was a bare "Suspend"/"Activate" button sitting in the last
 * column: it named no record, so a reader scanning a row had to work out which account it
 * belonged to, and it wrote the new status immediately. Moving it into a menu gives the
 * action an accessible name that includes the person, keeps the row itself uncluttered, and
 * — with `ConfirmDialog` on the screen — lets the destructive direction be confirmed while
 * the safe one stays a single click.
 *
 * `INVITED` accounts are disabled rather than hidden: the API accepts a status change for
 * them, but an invitation that has never been accepted has nothing to suspend or restore,
 * so offering the control would be a lie about what it does.
 */
export function UserRowMenu({
  user,
  onChangeStatus,
}: {
  readonly user: UserSummary;
  readonly onChangeStatus: (user: UserSummary) => void;
}) {
  const suspending = user.status === 'ACTIVE';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${user.displayName}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          variant={suspending ? 'destructive' : 'default'}
          disabled={user.status === 'INVITED'}
          onClick={() => onChangeStatus(user)}
        >
          {suspending ? (
            <UserXIcon aria-hidden="true" className="size-4" />
          ) : (
            <UserCheckIcon aria-hidden="true" className="size-4" />
          )}
          {suspending ? 'Suspend' : 'Activate'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
