'use client';

import * as React from 'react';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { FilterXIcon, InboxIcon } from 'lucide-react';

import { DataTableBulkBar } from './data-table-bulk-bar';
import { DataTablePagination } from './data-table-pagination';
import { DataTableSortHeader } from './data-table-sort-header';
import { DataTableToolbar, type DataTableFilterChip } from './data-table-toolbar';
import {
  EMPTY_FILTERS,
  type DataTableBulkAction,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableSortState,
  type DataTableView,
  type DataTableViewsConfig,
  type DataTableViewState,
  type FilterState,
} from './types';
import { loadPersistedViews, savePersistedViews, type PersistedView } from './views-storage';

/**
 * The enterprise row table — the pattern every HRIS list builds on.
 *
 * Generic over the row type and decoupled from any data source: it receives the
 * candidate rows and owns the presentation state (search, filters, sort, pagination,
 * selection, column visibility, saved views) that recruitment, attendance, leave,
 * claims, payroll and the rest will all need. Paging runs over the rows already on
 * the client; the column/filter model maps one-to-one to a server query such as
 * `EmployeeListParams` when a module grows a real endpoint.
 */
export function HrisDataTable<TRow extends { readonly id: string }>({
  rows,
  columns,
  filters = [],
  searchable = true,
  searchText,
  searchPlaceholder = 'Search…',
  defaultSort,
  selectable = true,
  pagination = true,
  pageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  views,
  bulkActions,
  actions,
  status = 'ready',
  loadingRows = 8,
  errorCopy = 'Something went wrong while loading the rows.',
  onRetry,
  emptyTitle = 'No rows yet',
  emptyDescription,
  emptyAction,
  noResultsTitle = 'Nothing matches your search or filters',
  noResultsDescription,
  onSelectionChange,
  rowClassName,
  initialFilters,
  initialSearch = '',
}: {
  rows: readonly TRow[];
  columns: readonly DataTableColumn<TRow>[];
  filters?: readonly DataTableFilter<TRow>[];
  /** Disable the toolbar search for lists that have no free text to match. */
  searchable?: boolean;
  /** The free text a row matches against; defaults to every string field joined. */
  searchText?: (row: TRow) => string;
  searchPlaceholder?: string;
  defaultSort?: DataTableSortState;
  selectable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  views?: DataTableViewsConfig;
  bulkActions?: readonly DataTableBulkAction<TRow>[];
  /** Controls rendered on the right edge of the toolbar. */
  actions?: React.ReactNode;
  status?: 'ready' | 'loading' | 'error';
  loadingRows?: number;
  errorCopy?: string;
  onRetry?: () => void;
  /** Shown when the table has no rows at all, as opposed to rows the filters removed. */
  emptyTitle?: string;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  noResultsTitle?: string;
  noResultsDescription?: React.ReactNode;
  onSelectionChange?: (ids: ReadonlySet<string>) => void;
  rowClassName?: (row: TRow) => string | undefined;
  /** Applied on first mount only; later filter changes belong to the table itself. */
  initialFilters?: FilterState;
  initialSearch?: string;
}) {
  const initialVisibility = React.useMemo(
    () =>
      new Set(
        columns
          .filter((column) => column.hideable !== false && column.defaultVisible !== false)
          .map((column) => column.id),
      ),
    [columns],
  );

  // ── Presentation state ──────────────────────────────────────────────────────────

  const [search, setSearch] = React.useState(initialSearch);
  const [filterState, setFilterState] = React.useState<FilterState>(
    initialFilters ?? EMPTY_FILTERS,
  );
  const [sort, setSort] = React.useState<DataTableSortState | undefined>(defaultSort);
  const [activePageSize, setActivePageSize] = React.useState(pageSize);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [visible, setVisible] = React.useState<ReadonlySet<string>>(initialVisibility);
  const [selectedKeys, setSelectedKeys] = React.useState<readonly string[]>([]);
  const selectedSet = React.useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const [activeViewId, setActiveViewId] = React.useState<string | undefined>(undefined);
  const [savedViews, setSavedViews] = React.useState<readonly PersistedView[]>([]);
  const [defaultViewId, setDefaultViewId] = React.useState<string | undefined>(undefined);

  // Saved views seed once from storage; every later change writes back through the
  // same channel, so the seed and the persisted list cannot drift.
  React.useEffect(() => {
    if (views === undefined) return;
    const stored = loadPersistedViews(views.storageKey);
    setSavedViews(stored);
    const defaultId = stored.find((view) => view.default)?.id;
    setDefaultViewId(defaultId ?? views.builtIn.find((view) => view.default)?.id);
  }, [views]);

  // ── Derived rows ────────────────────────────────────────────────────────────────

  const matchesSearch = React.useCallback(
    (row: TRow) => {
      if (search === '') return true;
      const needle = search.trim().toLowerCase();
      const haystack = (searchText ?? defaultSearchText)(row).toLowerCase();
      return haystack.includes(needle);
    },
    [search, searchText],
  );

  const matchesFilters = React.useCallback(
    (row: TRow) =>
      filters.every((filter) => {
        if (filter.kind === 'select') {
          const wanted = filterState.select[filter.id] ?? 'ALL';
          return wanted === 'ALL' || filter.getValue(row) === wanted;
        }

        const range = filterState.ranges[filter.id];
        if (range === undefined) return true;
        const value = filter.getValue(row);
        if (range.from !== undefined && value < range.from) return false;
        if (range.to !== undefined && value > range.to) return false;
        return true;
      }),
    [filters, filterState],
  );

  const filtered = React.useMemo(
    () => rows.filter((row) => matchesSearch(row) && matchesFilters(row)),
    [rows, matchesSearch, matchesFilters],
  );

  const sorted = React.useMemo(() => {
    if (sort === undefined) return filtered;

    const column = columns.find((candidate) => candidate.id === sort.columnId);
    const accessor = column?.sortValue;
    if (accessor === undefined) return filtered;

    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((left, right) => {
      const byValue = compareValues(left, right, accessor);
      return byValue !== 0 ? factor * byValue : factor * left.id.localeCompare(right.id);
    });
  }, [filtered, sort, columns]);

  const pageCount = pagination ? Math.max(1, Math.ceil(sorted.length / activePageSize)) : 1;
  const clampedPage = Math.min(pageIndex, pageCount - 1);
  const start = clampedPage * activePageSize;
  const pagedRows = pagination ? sorted.slice(start, start + activePageSize) : sorted;

  // Search, filters, sort, page size or a new dataset all restart on the first page;
  // the reader's place under the old conditions is meaningless.
  React.useEffect(() => {
    setPageIndex(0);
  }, [search, filterState, sort, activePageSize, rows.length]);

  // ── Selection ───────────────────────────────────────────────────────────────────

  const toggleOne = React.useCallback((id: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return [...next];
    });
  }, []);

  const pageSelected = pagedRows.every((row) => selectedSet.has(row.id));
  const somePageSelected = pagedRows.some((row) => selectedSet.has(row.id));

  const togglePage = React.useCallback(() => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      const checkOff = pagedRows.every((row) => next.has(row.id));
      for (const row of pagedRows) {
        if (checkOff) next.delete(row.id);
        else next.add(row.id);
      }
      return [...next];
    });
  }, [pagedRows]);

  const selectedRows = React.useMemo(
    () => rows.filter((row) => selectedSet.has(row.id)),
    [rows, selectedSet],
  );

  React.useEffect(() => {
    onSelectionChange?.(selectedSet);
    // Propagating the current selection is a side effect, not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKeys]);

  // ── Column visibility ───────────────────────────────────────────────────────────

  const toggleColumn = React.useCallback((id: string) => {
    setVisible((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const resetColumns = React.useCallback(() => setVisible(initialVisibility), [initialVisibility]);

  // ── Saved views ─────────────────────────────────────────────────────────────────

  const persist = React.useCallback(
    (next: readonly PersistedView[]) => {
      if (views === undefined) return;
      setSavedViews(next);
      savePersistedViews(views.storageKey, next);
    },
    [views],
  );

  const applyView = React.useCallback(
    (id: string) => {
      const view = allViews(views?.builtIn ?? [], savedViews).find(
        (candidate) => candidate.id === id,
      );
      if (view === undefined) return;

      const state = view.state;
      if (state.filters !== undefined) setFilterState(state.filters);
      if (state.search !== undefined) setSearch(state.search);
      if (state.sort !== undefined) setSort(state.sort);
      if (state.pageSize !== undefined) setActivePageSize(state.pageSize);
      if (state.columns !== undefined) {
        setVisible(
          new Set(
            columns
              .filter((column) => column.hideable !== false)
              .filter((column) => state.columns?.[column.id] === true)
              .map((column) => column.id),
          ),
        );
      }

      setActiveViewId(id);
      setPageIndex(0);
    },
    [views, savedViews, columns],
  );

  const currentViewState = React.useMemo<DataTableViewState>(() => {
    const columnsState: Record<string, boolean> = {};
    for (const column of columns) {
      if (column.hideable === false) continue;
      columnsState[column.id] = visible.has(column.id);
    }
    return { filters: filterState, search, sort, pageSize: activePageSize, columns: columnsState };
  }, [columns, filterState, search, sort, activePageSize, visible]);

  const saveCurrentView = React.useCallback(
    (name: string) => {
      if (views === undefined) return;
      const id = `view-${Date.now()}`;
      persist([...savedViews, { id, name, state: currentViewState }]);
      setActiveViewId(id);
    },
    [views, savedViews, persist, currentViewState],
  );

  // ── Filter chips ────────────────────────────────────────────────────────────────

  const chips = React.useMemo<DataTableFilterChip[]>(() => {
    const result: DataTableFilterChip[] = [];

    if (search !== '') {
      result.push({ id: 'search', label: `Search: ${search}`, onRemove: () => setSearch('') });
    }

    for (const filter of filters) {
      if (filter.kind === 'select') {
        const value = filterState.select[filter.id] ?? 'ALL';
        if (value === 'ALL') continue;
        const option = filter.options.find((candidate) => candidate.value === value);
        result.push({
          id: `filter-${filter.id}`,
          label: `${filter.label}: ${option?.label ?? value}`,
          onRemove: () =>
            setFilterState((current) => ({
              ...current,
              select: { ...current.select, [filter.id]: 'ALL' },
            })),
        });
        continue;
      }

      const range = filterState.ranges[filter.id];
      if (range === undefined) continue;
      if (range.from !== undefined) {
        result.push({
          id: `filter-${filter.id}-from`,
          label: `${filter.label}: from ${range.from}`,
          onRemove: () =>
            setFilterState((current) => ({
              ...current,
              ranges: { ...current.ranges, [filter.id]: { ...range, from: undefined } },
            })),
        });
      }
      if (range.to !== undefined) {
        result.push({
          id: `filter-${filter.id}-to`,
          label: `${filter.label}: to ${range.to}`,
          onRemove: () =>
            setFilterState((current) => ({
              ...current,
              ranges: { ...current.ranges, [filter.id]: { ...range, to: undefined } },
            })),
        });
      }
    }

    return result;
  }, [filterState, filters, search]);

  const clearAll = React.useCallback(() => {
    setSearch('');
    setFilterState({ ...EMPTY_FILTERS });
    setActiveViewId(undefined);
    setPageIndex(0);
  }, []);

  // ── Early returns ───────────────────────────────────────────────────────────────

  if (status === 'error') {
    return <ErrorPanel error={errorCopy} onRetry={onRetry} />;
  }

  if (status === 'ready' && rows.length === 0) {
    return (
      <EmptyState
        icon={InboxIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  const noResults = status === 'ready' && rows.length > 0 && filtered.length === 0;
  const hasToolbar = searchable || filters.length > 0 || columns.length > 0 || views !== undefined;

  return (
    <div className="space-y-3">
      {hasToolbar && (
        <DataTableToolbar
          searchable={searchable}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={searchPlaceholder}
          filters={filters}
          filterState={filterState}
          onFilterStateChange={setFilterState}
          columns={columns}
          visibleColumns={visible}
          onToggleColumn={toggleColumn}
          onResetColumns={resetColumns}
          builtInViews={(views?.builtIn ?? []).map((view) => ({ id: view.id, name: view.name }))}
          savedViews={savedViews}
          defaultViewId={defaultViewId}
          activeViewId={activeViewId}
          onApplyView={applyView}
          onSaveView={saveCurrentView}
          onRenameView={(id, name) =>
            persist(savedViews.map((view) => (view.id === id ? { ...view, name } : view)))
          }
          onDeleteView={(id) => {
            const next = savedViews.filter((view) => view.id !== id);
            if (defaultViewId === id) setDefaultViewId(undefined);
            if (activeViewId === id) setActiveViewId(undefined);
            persist(next);
          }}
          onSetDefaultView={(id) => {
            setDefaultViewId(id);
            persist(savedViews.map((view) => (view.id === id ? { ...view, default: true } : view)));
          }}
          actions={actions}
          chips={chips}
          onClearAll={clearAll}
        />
      )}

      {status === 'loading' && <TableSkeleton columns={columns.length + 1} rows={loadingRows} />}

      {status === 'ready' && selectedSet.size > 0 && (
        <DataTableBulkBar
          selectedRows={selectedRows}
          actions={bulkActions ?? []}
          onClear={() => setSelectedKeys([])}
        />
      )}

      {status === 'ready' && noResults && (
        <EmptyState
          icon={FilterXIcon}
          title={noResultsTitle}
          description={noResultsDescription}
          action={
            search !== '' || chips.length > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="rounded-md px-2 py-1 text-sm text-foreground underline-offset-4 hover:bg-muted hover:underline"
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      )}

      {status === 'ready' && !noResults && (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <Table containerClassName="max-h-[70vh] overflow-auto overscroll-contain">
            <TableHeader className="sticky top-0 z-10 bg-table-header backdrop-blur-sm">
              <TableRow className="hover:bg-transparent">
                {selectable && (
                  <TableHead className="w-10 pl-4">
                    <Checkbox
                      aria-label={pageSelected ? 'Deselect this page' : 'Select this page'}
                      checked={pageSelected}
                      indeterminate={!pageSelected && somePageSelected}
                      onCheckedChange={togglePage}
                    />
                  </TableHead>
                )}

                {columns.map((column) => {
                  if (column.hideable !== false && !visible.has(column.id)) return null;

                  const sortable = column.sortValue !== undefined;
                  const activeSort = sort?.columnId === column.id;

                  return (
                    <TableHead
                      key={column.id}
                      aria-sort={
                        activeSort
                          ? sort?.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                      className={cn(
                        column.responsive,
                        column.align === 'right' && 'text-right',
                        column.headerClassName,
                      )}
                    >
                      {sortable ? (
                        <DataTableSortHeader
                          label={column.header}
                          active={activeSort ? sort : undefined}
                          onToggle={() => setSort(toggleSort(sort, column.id))}
                          className={column.align === 'right' ? 'justify-end' : undefined}
                        />
                      ) : (
                        column.header
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>

            <TableBody>
              {pagedRows.map((row) => {
                const isSelected = selectedSet.has(row.id);

                return (
                  <TableRow
                    key={row.id}
                    aria-selected={isSelected || undefined}
                    className={cn(isSelected && 'bg-primary/[0.08]', rowClassName?.(row))}
                  >
                    {selectable && (
                      <TableCell className="pl-4">
                        <Checkbox
                          aria-label={`Select ${row.id}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(row.id)}
                        />
                      </TableCell>
                    )}

                    {columns.map((column) => {
                      if (column.hideable !== false && !visible.has(column.id)) return null;

                      return (
                        <TableCell
                          key={column.id}
                          className={cn(
                            column.responsive,
                            column.align === 'right' && 'text-right',
                            column.cellClassName,
                          )}
                        >
                          {column.cell(row)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination && status === 'ready' && !noResults && filtered.length > 0 && (
        <DataTablePagination
          pageIndex={clampedPage}
          pageCount={pageCount}
          from={start + 1}
          to={start + pagedRows.length}
          total={filtered.length}
          pageSize={activePageSize}
          pageSizeOptions={[...pageSizeOptions]}
          onPageChange={setPageIndex}
          onPageSizeChange={setActivePageSize}
        />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────────

function defaultSearchText<TRow extends { readonly id: string }>(row: TRow): string {
  return Object.values(row).join(' ');
}

function compareValues<TRow extends { readonly id: string }>(
  left: TRow,
  right: TRow,
  accessor: NonNullable<DataTableColumn<TRow>['sortValue']>,
): number {
  const leftValue = accessor(left);
  const rightValue = accessor(right);
  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return leftValue - rightValue;
  }
  return String(leftValue).localeCompare(String(rightValue), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function toggleSort(
  current: DataTableSortState | undefined,
  columnId: string,
): DataTableSortState | undefined {
  if (current === undefined || current.columnId !== columnId) {
    return { columnId, direction: 'asc' };
  }
  if (current.direction === 'asc') {
    return { columnId, direction: 'desc' };
  }
  return undefined;
}

function allViews(
  builtIn: readonly DataTableView[],
  saved: readonly PersistedView[],
): readonly { readonly id: string; readonly state: DataTableViewState }[] {
  return [
    ...builtIn.map((view) => ({ id: view.id, state: view.state })),
    ...saved.map((view) => ({ id: view.id, state: view.state })),
  ];
}

function TableSkeleton({ columns, rows }: { columns: number; rows: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <Table containerClassName="max-h-[70vh] overflow-auto overscroll-contain">
        <TableHeader className="sticky top-0 z-10 bg-table-header">
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: columns }, (_, index) => (
              <TableHead key={index} className={index === 0 ? 'pl-4' : undefined}>
                <Skeleton className="h-3 w-16" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columns }, (__column, columnIndex) => (
                <TableCell key={columnIndex} className={columnIndex === 0 ? 'pl-4' : undefined}>
                  <Skeleton className="h-3.5 w-24" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
