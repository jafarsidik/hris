import {
  EMPTY_FILTERS,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { AiModelSummary } from '@hris/shared-types';
import { ModelRowMenu } from './model-row-menu';

/**
 * The models table's contract: which columns it shows, how it filters, and which views it
 * offers. Kept apart from the screen so the screen stays about behaviour, exactly as the
 * IAM users directory splits the same concerns.
 *
 * Before this existed the screen hand-rolled its own `<table>` with no sorting, no
 * pagination, no column visibility, no row menu and no empty state beyond a paragraph.
 * The shared table brings all of that at once.
 */

export const MODEL_VIEWS_STORAGE_KEY = 'hris:models:views';

/** The free text a row matches against; every column a reader would search by. */
export const MODEL_SEARCH_TEXT = (row: AiModelSummary): string =>
  [row.key, row.name, row.provider].join(' ');

const ENABLED_OPTIONS = [
  { value: 'true', label: 'Enabled' },
  { value: 'false', label: 'Disabled' },
] as const;

/**
 * The filters the toolbar shows.
 *
 * The enabled vocabulary is fixed rather than derived from the rows, so "show me the
 * disabled models" cannot disappear at exactly the moment there are none. The provider list
 * is unioned from the rows actually carried, sorted for stability.
 */
export function buildModelFilters(
  rows: readonly AiModelSummary[],
): readonly DataTableFilter<AiModelSummary>[] {
  const providers = [
    ...new Set(rows.map((row) => row.provider).filter((provider) => provider !== '')),
  ]
    .sort((left, right) => left.localeCompare(right))
    .map((provider) => ({ value: provider, label: provider }));

  return [
    {
      kind: 'select',
      id: 'enabled',
      label: 'Enabled',
      placeholder: 'All models',
      getValue: (row) => String(row.isEnabled),
      options: ENABLED_OPTIONS,
    },
    {
      kind: 'select',
      id: 'provider',
      label: 'Provider',
      placeholder: 'All providers',
      getValue: (row) => row.provider,
      advanced: true,
      options: providers,
    },
  ];
}

const withEnabled = (isEnabled: boolean) => ({
  filters: { ...EMPTY_FILTERS, select: { enabled: String(isEnabled) } },
  search: '',
});

/** Views the models list ships with; the first is the default. */
export const MODEL_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All models',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'enabled', name: 'Enabled', builtIn: true, state: withEnabled(true) },
  { id: 'disabled', name: 'Disabled', builtIn: true, state: withEnabled(false) },
];

/**
 * The columns.
 *
 * The actions column is omitted when the reader has neither `ai.update` nor `ai.delete`,
 * rather than rendering a column of controls that are disabled or that silently do nothing.
 * The menu itself is the only writer, so the permission question is asked once, by the
 * screen.
 */
export function buildModelColumns({
  canUpdate,
  canDelete,
  onToggle,
  onEdit,
  onDelete,
}: {
  readonly canUpdate: boolean;
  readonly canDelete: boolean;
  readonly onToggle: (
    row: AiModelSummary,
    patch: { isDefault?: boolean; isEnabled?: boolean },
  ) => void;
  readonly onEdit: (row: AiModelSummary) => void;
  readonly onDelete: (row: AiModelSummary) => void;
}): readonly DataTableColumn<AiModelSummary>[] {
  const columns: DataTableColumn<AiModelSummary>[] = [
    {
      id: 'model',
      header: 'Model',
      sortValue: (row) => row.key,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-mono text-sm">{row.key}</span>
          <span className="text-xs text-muted-foreground">{row.name}</span>
        </div>
      ),
    },
    {
      id: 'provider',
      header: 'Provider',
      sortValue: (row) => row.provider,
      cellClassName: 'text-sm',
      cell: (row) => row.provider,
    },
    {
      id: 'context',
      header: 'Context',
      align: 'right',
      sortValue: (row) => row.contextWindow ?? -1,
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.contextWindow ?? '—',
    },
    {
      id: 'price',
      header: 'Price in / out (per 1M)',
      align: 'right',
      sortValue: (row) => row.inputPricePerMillion ?? -1,
      cellClassName: 'font-mono text-sm',
      cell: (row) => (
        <>
          {row.inputPricePerMillion === null ? '—' : `$${row.inputPricePerMillion}`} /{' '}
          {row.outputPricePerMillion === null ? '—' : `$${row.outputPricePerMillion}`}
        </>
      ),
    },
    {
      id: 'default',
      header: 'Default',
      sortValue: (row) => (row.isDefault ? 1 : 0),
      cell: (row) =>
        row.isDefault ? (
          <Badge variant="success">DEFAULT</Badge>
        ) : (
          canUpdate && (
            <Button variant="ghost" size="sm" onClick={() => onToggle(row, { isDefault: true })}>
              Make default
            </Button>
          )
        ),
    },
    {
      id: 'enabled',
      header: 'Enabled',
      sortValue: (row) => (row.isEnabled ? 1 : 0),
      cell: (row) => (
        <Switch
          checked={row.isEnabled}
          disabled={!canUpdate}
          onCheckedChange={(next) => onToggle(row, { isEnabled: next })}
        />
      ),
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (row) => (
        <ModelRowMenu
          row={row}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ),
    });
  }

  return columns;
}
