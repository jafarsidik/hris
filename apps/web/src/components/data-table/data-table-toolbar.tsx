'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SearchIcon, XIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { DataTableColumnToggle } from './data-table-column-toggle';
import { DataTableToolbarFilterSelect } from './data-table-filter-select';
import { DataTableMoreFilters } from './data-table-more-filters';
import { DataTableViews } from './data-table-views';
import type { DataTableColumn, DataTableFilter, FilterState } from './types';
import type { PersistedView } from './views-storage';

export interface DataTableFilterChip {
  readonly id: string;
  readonly label: string;
  readonly onRemove: () => void;
}

/**
 * The toolbar above the table: contextual search, the quick filters, the advanced
 * (More filters) surface, column and view menus, and whatever extra controls the page
 * puts on the right — in the employees directory that is nothing, because Import,
 * Export and Add live in the page header.
 */
export function DataTableToolbar<TRow extends { readonly id: string }>({
  searchable,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  filterState,
  onFilterStateChange,
  columns,
  visibleColumns,
  onToggleColumn,
  onResetColumns,
  builtInViews,
  savedViews,
  defaultViewId,
  activeViewId,
  onApplyView,
  onSaveView,
  onRenameView,
  onDeleteView,
  onSetDefaultView,
  actions,
  chips,
  onClearAll,
}: {
  searchable: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: readonly DataTableFilter<TRow>[];
  filterState: FilterState;
  onFilterStateChange: (next: FilterState) => void;
  columns: readonly DataTableColumn<TRow>[];
  visibleColumns: ReadonlySet<string>;
  onToggleColumn: (id: string) => void;
  onResetColumns: () => void;
  builtInViews: readonly { readonly id: string; readonly name: string }[];
  savedViews: readonly PersistedView[];
  defaultViewId: string | undefined;
  activeViewId: string | undefined;
  onApplyView: (id: string) => void;
  onSaveView: (name: string) => void;
  onRenameView: (id: string, name: string) => void;
  onDeleteView: (id: string) => void;
  onSetDefaultView: (id: string | undefined) => void;
  actions?: ReactNode;
  chips: readonly DataTableFilterChip[];
  onClearAll: () => void;
}) {
  const quick = filters.filter(
    (filter): filter is Extract<DataTableFilter<TRow>, { kind: 'select' }> =>
      filter.kind === 'select' && filter.advanced !== true,
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {searchable && (
          <div className="relative min-w-44 max-w-xs flex-1">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search table"
              className="h-8 pl-8 pr-8"
            />
            {searchValue !== '' && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <XIcon aria-hidden="true" className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {quick.map((filter) => (
          <DataTableToolbarFilterSelect
            key={filter.id}
            filter={filter}
            value={filterState.select[filter.id] ?? 'ALL'}
            onChange={(value) =>
              onFilterStateChange({
                ...filterState,
                select: { ...filterState.select, [filter.id]: value },
              })
            }
          />
        ))}

        {filters.some((filter) => filter.kind === 'select' && filter.advanced === true) && (
          <DataTableMoreFilters
            filters={filters}
            value={filterState}
            onChange={onFilterStateChange}
          />
        )}

        <div className={cn('flex items-center gap-2', quick.length > 0 && 'md:ml-2')}>
          <DataTableColumnToggle
            columns={columns}
            visible={visibleColumns}
            onToggle={onToggleColumn}
            onReset={onResetColumns}
          />

          <DataTableViews
            builtIn={builtInViews}
            saved={savedViews}
            defaultId={defaultViewId}
            activeId={activeViewId}
            onApply={onApplyView}
            onSaveCurrent={onSaveView}
            onRename={onRenameView}
            onDelete={onDeleteView}
            onSetDefault={onSetDefaultView}
          />
        </div>

        {actions !== undefined && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-muted/60 py-0 pr-1 pl-2.5 text-xs text-foreground"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`Remove ${chip.label} filter`}
                className="grid size-4 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <XIcon aria-hidden="true" className="size-3" />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={onClearAll}
            className="px-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
