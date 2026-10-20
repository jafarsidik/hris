import {
  EMPTY_FILTERS,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';

import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import type { AiAgentSummary } from '@hris/shared-types';
import { AgentRowMenu } from './agent-row-menu';

/**
 * The agents table's contract: which columns it shows, how it filters, and which views it
 * offers. Kept apart from the screen so the screen stays about behaviour, exactly as the
 * IAM users directory splits the same concerns.
 *
 * Before this existed the screen hand-rolled its own `<table>` with no sorting, no
 * pagination, no column visibility, no row menu and no empty state beyond a paragraph.
 * The shared table brings all of that at once.
 */

export const AGENT_VIEWS_STORAGE_KEY = 'hris:agents:views';

/** The free text a row matches against; every column a reader would search by. */
export const AGENT_SEARCH_TEXT = (row: AiAgentSummary): string =>
  [row.name, row.key, row.promptKey ?? '', row.modelKey ?? '', row.tools.join(' ')].join(' ');

const ENABLED_OPTIONS = [
  { value: 'true', label: 'Enabled' },
  { value: 'false', label: 'Disabled' },
] as const;

/**
 * The filters the toolbar shows.
 *
 * The enabled vocabulary is fixed rather than derived from the rows, so "show me the
 * disabled agents" cannot disappear at exactly the moment there are none.
 */
export function buildAgentFilters(): readonly DataTableFilter<AiAgentSummary>[] {
  return [
    {
      kind: 'select',
      id: 'enabled',
      label: 'Enabled',
      placeholder: 'All agents',
      getValue: (row) => String(row.isEnabled),
      options: ENABLED_OPTIONS,
    },
  ];
}

const withEnabled = (isEnabled: boolean) => ({
  filters: { ...EMPTY_FILTERS, select: { enabled: String(isEnabled) } },
  search: '',
});

/** Views the agents list ships with; the first is the default. */
export const AGENT_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All agents',
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
export function buildAgentColumns({
  canUpdate,
  canDelete,
  onToggleEnabled,
  onEdit,
  onDelete,
}: {
  readonly canUpdate: boolean;
  readonly canDelete: boolean;
  readonly onToggleEnabled: (row: AiAgentSummary, enabled: boolean) => void;
  readonly onEdit: (row: AiAgentSummary) => void;
  readonly onDelete: (row: AiAgentSummary) => void;
}): readonly DataTableColumn<AiAgentSummary>[] {
  const columns: DataTableColumn<AiAgentSummary>[] = [
    {
      id: 'agent',
      header: 'Agent',
      sortValue: (row) => row.name,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.key}</span>
        </div>
      ),
    },
    {
      id: 'prompt',
      header: 'Prompt',
      sortValue: (row) => row.promptKey ?? '',
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.promptKey ?? '—',
    },
    {
      id: 'model',
      header: 'Model',
      sortValue: (row) => row.modelKey ?? '',
      cellClassName: 'font-mono text-sm',
      cell: (row) => row.modelKey ?? '—',
    },
    {
      id: 'tools',
      header: 'Tools',
      sortValue: (row) => row.tools.join(', '),
      cell: (row) =>
        row.tools.length === 0 ? (
          <span className="text-sm text-muted-foreground">none</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {row.tools.map((tool) => (
              <Badge key={tool} variant="outline">
                {tool}
              </Badge>
            ))}
          </span>
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
          onCheckedChange={(next) => void onToggleEnabled(row, next)}
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
        <AgentRowMenu
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
