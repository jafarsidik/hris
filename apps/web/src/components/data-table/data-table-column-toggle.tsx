'use client';

import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ColumnsIcon, RotateCcw } from 'lucide-react';

import type { DataTableColumn } from './types';

/**
 * The Columns dropdown.
 *
 * Every column can be hidden, including the ones that were visible by default — the
 * table must let a dense reader reclaim space. "Reset" restores the column list the
 * page shipped with.
 */
export function DataTableColumnToggle<TRow extends { readonly id: string }>({
  columns,
  visible,
  onToggle,
  onReset,
}: {
  columns: readonly DataTableColumn<TRow>[];
  visible: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onReset: () => void;
}) {
  const toggleables = columns.filter((column) => column.hideable !== false);
  const countVisible = toggleables.filter((column) => visible.has(column.id)).length;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
            aria-label={`Columns, ${countVisible} of ${toggleables.length} visible`}
          />
        }
      >
        <ColumnsIcon aria-hidden="true" className="size-3.5" />
        Columns
      </PopoverTrigger>

      <PopoverContent align="end" className="w-52 p-2">
        <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">Column visibility</p>

        <div className="space-y-0.5">
          {toggleables.map((column) => (
            <div
              key={column.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={visible.has(column.id)}
                onCheckedChange={() => onToggle(column.id)}
                aria-label={`Show ${column.id} column`}
              />
              <span className="flex-1">{column.header}</span>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start"
          onClick={onReset}
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Reset to default
        </Button>
      </PopoverContent>
    </Popover>
  );
}
