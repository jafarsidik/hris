'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { IntegrationSummary } from './integration-types';
import { MoreHorizontalIcon, Plug, Stethoscope } from 'lucide-react';
import Link from 'next/link';

/**
 * The per-row actions menu for the connections list.
 *
 * Test and Configure used to be two inline buttons in the last column; the kebab
 * keeps the row uncluttered and gives the trigger an accessible name that includes
 * the connection. Test is disabled for a reader without `integration.manage` — the
 * same permission the screen's enable switch checks — and while a test is in flight.
 */
export function ConnectionRowMenu({
  connection,
  busy,
  canManage,
  onTest,
}: {
  readonly connection: IntegrationSummary;
  readonly busy: boolean;
  readonly canManage: boolean;
  readonly onTest: (connection: IntegrationSummary) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${connection.name}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem disabled={busy || !canManage} onClick={() => onTest(connection)}>
          <Stethoscope aria-hidden="true" className="size-4" />
          Test
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/setup/integrations/${connection.id}`} />}>
          <Plug aria-hidden="true" className="size-4" />
          Configure
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
