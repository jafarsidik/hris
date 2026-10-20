'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { OutboxEventSummary } from '@hris/shared-types';
import { MoreHorizontalIcon, RefreshCw } from 'lucide-react';

/**
 * The per-row actions menu.
 *
 * The only action the history offers is retrying a delivery that is still owed, so the
 * menu exists only while an event is pending — a delivered event gets an empty cell
 * rather than a menu whose single item would be a lie about what it does. The retry
 * itself is not destructive, so it stays a single click and routes through the screen's
 * own handler, which reports the outcome in the notice banner.
 */
export function EventRowMenu({
  event,
  onRetry,
}: {
  readonly event: OutboxEventSummary;
  readonly onRetry: (id: string) => void;
}) {
  if (event.publishedAt !== null) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${event.type}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onRetry(event.id)}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Retry
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
