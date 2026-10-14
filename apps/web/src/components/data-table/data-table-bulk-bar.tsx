'use client';

import { Button } from '@/components/ui/button';
import { XIcon } from 'lucide-react';

import type { DataTableBulkAction } from './types';

/**
 * The toolbar that appears once rows are selected.
 *
 * A disabled bulk action states why it is disabled — the copy is the point, not the
 * disabled button. The reason therefore rides in the control's aria-label, never in
 * a tooltip that a disabled button cannot raise and a keyboard user cannot reach.
 */
export function DataTableBulkBar<TRow extends { readonly id: string }>({
  selectedRows,
  actions,
  onClear,
}: {
  selectedRows: readonly TRow[];
  actions: readonly DataTableBulkAction<TRow>[];
  onClear: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label={`${selectedRows.length} rows selected`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2"
    >
      <p className="text-sm font-medium tabular-nums">{selectedRows.length} selected</p>

      <div className="flex items-center gap-2">
        {actions.map((action) => {
          const Icon = action.icon;

          if (action.disabled === true) {
            return (
              <Button
                key={action.id}
                type="button"
                variant="outline"
                size="sm"
                disabled
                aria-label={`${action.label} — ${action.disabledReason ?? 'not available in this build'}`}
              >
                {Icon !== undefined && <Icon aria-hidden="true" className="size-3.5" />}
                {action.label}
              </Button>
            );
          }

          return (
            <Button
              key={action.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => action.run?.(selectedRows, onClear)}
            >
              {Icon !== undefined && <Icon aria-hidden="true" className="size-3.5" />}
              {action.label}
            </Button>
          );
        })}

        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <XIcon aria-hidden="true" className="size-3.5" />
          Clear
        </Button>
      </div>
    </div>
  );
}
