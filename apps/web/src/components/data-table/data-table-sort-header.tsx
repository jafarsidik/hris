'use client';

import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ReactNode } from 'react';

import type { DataTableSortState } from './types';

/**
 * A sortable column header.
 *
 * The direction is embedded in the label ("Sort by name, ascending") so the control
 * never depends on the arrow glyph alone, and `aria-sort` on the owning `<th>` is how
 * screen readers are told which column currently orders the table.
 */
export function DataTableSortHeader({
  label,
  active,
  onToggle,
  className,
}: {
  label: ReactNode;
  active?: DataTableSortState;
  onToggle: () => void;
  className?: string;
}) {
  const Icon =
    active === undefined ? ArrowUpDown : active.direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={
        active === undefined
          ? `Sort by ${label}`
          : active.direction === 'asc'
            ? `Sort by ${label}, ascending`
            : `Sort by ${label}, descending`
      }
      className={cn(
        '-m-1 flex items-center gap-1 rounded-md p-1 text-left font-medium normal-case cursor-pointer outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
        active !== undefined ? 'text-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      {label}
      <Icon
        aria-hidden="true"
        className={cn(
          'size-3.5 shrink-0',
          active === undefined ? 'opacity-40' : 'text-muted-foreground',
        )}
      />
    </button>
  );
}
