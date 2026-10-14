'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import type { DataTableSelectFilter } from './types';

/**
 * A toolbar dropdown filter.
 *
 * Shows the active value (or the "all" placeholder) in the collapsed trigger, which
 * matches how enterprise filter bars read: one glance at the bar tells you what the
 * directory is narrowed to. `"ALL"` is a real item with the placeholder's label, so
 * clearing a filter is an ordinary selection rather than a hidden reset.
 */
export function DataTableToolbarFilterSelect<TRow extends { readonly id: string }>({
  filter,
  value,
  onChange,
}: {
  filter: DataTableSelectFilter<TRow>;
  value: string;
  onChange: (value: string) => void;
}) {
  const displayValue = value === 'ALL' ? filter.placeholder : value;

  return (
    <Select value={value} onValueChange={(next) => onChange(next ?? 'ALL')}>
      <SelectTrigger
        size="sm"
        className={cn(value !== 'ALL' && 'font-medium text-foreground')}
        aria-label={`Filter by ${filter.label}: ${displayValue}`}
      >
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
  );
}
