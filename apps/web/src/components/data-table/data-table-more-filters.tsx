'use client';

import * as React from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SlidersHorizontal, XIcon } from 'lucide-react';

import { EMPTY_FILTERS, type DataTableFilter, type FilterState } from './types';

/**
 * The "More filters" surface.
 *
 * Referenced filters edit a draft that is committed by "Apply filters", so hovering
 * the popover never leaves the directory half-filtered; Reset clears the draft back
 * to what is currently applied. The range fields and the advanced selects are driven
 * by the same {@link DataTableFilter} configs as the toolbar, so a filter added here
 * shows up in the toolbar changes too and there is no second source of truth for what
 * the directory can filter on.
 */
export function DataTableMoreFilters<TRow extends { readonly id: string }>({
  filters,
  value,
  onChange,
}: {
  filters: readonly DataTableFilter<TRow>[];
  value: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const advanced = filters.filter(
    (filter) => (filter.kind === 'select' && filter.advanced === true) || filter.kind === 'range',
  );

  const [draft, setDraft] = React.useState<FilterState>(EMPTY_FILTERS);
  const [open, setOpen] = React.useState(false);

  // Reset the draft each time the popover opens so it reflects the committed filters,
  // not whatever was left half-edited the last time it closed.
  React.useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const apply = () => {
    onChange(draft);
    setOpen(false);
  };

  const reset = () => setDraft(EMPTY_FILTERS);

  const setSelect = (id: string, selected: string) =>
    setDraft((current) => ({ ...current, select: { ...current.select, [id]: selected } }));

  const setRange = (id: string, key: 'from' | 'to', next: string) =>
    setDraft((current) => {
      const range = current.ranges[id] ?? {};
      return {
        ...current,
        ranges: { ...current.ranges, [id]: { ...range, [key]: next === '' ? undefined : next } },
      };
    });

  const activeCount = advanced.filter((filter) => isFilterActive(filter, value)).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
            aria-label={`More filters${activeCount > 0 ? `, ${activeCount} active` : ''}`}
            aria-expanded={open}
          />
        }
      >
        <SlidersHorizontal aria-hidden="true" className="size-3.5" />
        More filters
        {activeCount > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">({activeCount})</span>
        )}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[19rem]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Filter employees</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs"
              onClick={reset}
            >
              <XIcon aria-hidden="true" className="size-3.5" />
              Reset
            </Button>
          </div>

          {advanced.map((filter) => {
            if (filter.kind === 'range') {
              const range = draft.ranges[filter.id] ?? {};
              return (
                <div key={filter.id} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{filter.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`more-${filter.id}-from`} className="text-xs">
                        {filter.fromLabel}
                      </Label>
                      <DateInput
                        id={`more-${filter.id}-from`}
                        value={range.from ?? ''}
                        onChange={(event) => setRange(filter.id, 'from', event.target.value)}
                        aria-label={`${filter.label} from`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`more-${filter.id}-to`} className="text-xs">
                        {filter.toLabel}
                      </Label>
                      <DateInput
                        id={`more-${filter.id}-to`}
                        value={range.to ?? ''}
                        onChange={(event) => setRange(filter.id, 'to', event.target.value)}
                        aria-label={`${filter.label} to`}
                      />
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={filter.id} className="space-y-1.5">
                <Label htmlFor={`more-${filter.id}`}>{filter.label}</Label>
                <Select
                  value={draft.select[filter.id] ?? 'ALL'}
                  onValueChange={(selected) => setSelect(filter.id, selected ?? 'ALL')}
                >
                  <SelectTrigger id={`more-${filter.id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{filter.placeholder}</SelectItem>
                    {filter.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}

          {advanced.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No advanced filters are configured for this table.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={apply}>
              Apply filters
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function isFilterActive<TRow extends { readonly id: string }>(
  filter: DataTableFilter<TRow>,
  value: FilterState,
): boolean {
  if (filter.kind === 'select') {
    return (value.select[filter.id] ?? 'ALL') !== 'ALL';
  }
  const range = value.ranges[filter.id];
  return range !== undefined && (range.from !== undefined || range.to !== undefined);
}
