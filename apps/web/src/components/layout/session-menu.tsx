'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { CircleUser, LifeBuoy, LogOut, Palette, Settings, UserRound } from 'lucide-react';

/**
 * The account control in the header.
 *
 * Every action is disabled, because phase 2 builds authentication and nothing about a
 * session exists yet. They are shown disabled rather than omitted so the finished
 * surface is visible without implying any of it works. A visible dead control is
 * honest; a missing one is just an absence nobody can evaluate.
 */
export function SessionMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account"
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          />
        }
      >
        <CircleUser aria-hidden="true" className="size-5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Not signed in</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>
          <UserRound aria-hidden="true" className="size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Settings aria-hidden="true" className="size-4" />
          Preferences
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <LifeBuoy aria-hidden="true" className="size-4" />
          Help
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <Palette aria-hidden="true" className="size-3.5" />
            Appearance
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <ThemeToggle />

        <DropdownMenuSeparator />
        <DropdownMenuItem disabled variant="destructive">
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
