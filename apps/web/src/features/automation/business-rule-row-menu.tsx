'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { BusinessRuleSummary } from '@hris/shared-types';
import { MoreHorizontalIcon, Power, Trash2 } from 'lucide-react';

/**
 * The per-row actions menu.
 *
 * The screen's previous controls were bare "Disable"/"Enable" and "Delete" buttons in the
 * last column: they named no record, so a reader scanning a row had to work out which rule
 * they belonged to, and the delete wrote on a single click with a `window.confirm`. Moving
 * them into a menu gives the actions an accessible name that includes the rule, and the
 * delete routes through the screen's `ConfirmDialog`.
 */
export function BusinessRuleRowMenu({
  rule,
  onToggle,
  onDelete,
}: {
  readonly rule: BusinessRuleSummary;
  readonly onToggle: (rule: BusinessRuleSummary) => void;
  readonly onDelete: (rule: BusinessRuleSummary) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Actions for ${rule.name}`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        }
      >
        <MoreHorizontalIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onToggle(rule)}>
          <Power aria-hidden="true" className="size-4" />
          {rule.isEnabled ? 'Disable' : 'Enable'}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onClick={() => onDelete(rule)}>
          <Trash2 aria-hidden="true" className="size-4" />
          Delete rule
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
