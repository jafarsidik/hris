import {
  EMPTY_FILTERS,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';

import { Badge } from '@/components/ui/badge';
import {
  INTEGRATION_STATUSES,
  type IntegrationStatus,
  type IntegrationSummary,
} from '@hris/shared-types';
import Link from 'next/link';

import { KIND_LABELS, formatTimestamp, statusBadgeVariant } from './integration-presentation';
import { IntegrationRowMenu } from './integration-row-menu';

export const INTEGRATION_VIEWS_STORAGE_KEY = 'hris:integrations:views';

/** The free text a row matches against. */
export const INTEGRATION_SEARCH_TEXT = (integration: IntegrationSummary): string =>
  `${integration.name} ${integration.key} ${integration.kind} ${integration.provider} ${integration.status}`;

/**
 * The filters the toolbar shows.
 *
 * The status vocabulary is always offered, unioned with whatever the rows actually
 * carry — the same rule the users list follows.
 */
export function buildIntegrationFilters(
  rows: readonly IntegrationSummary[],
): readonly DataTableFilter<IntegrationSummary>[] {
  const present = new Set<IntegrationStatus>([
    ...INTEGRATION_STATUSES,
    ...rows.map((row) => row.status),
  ]);
  const statusOptions = [...present].map((status) => ({ value: status, label: status }));

  return [
    {
      kind: 'select',
      id: 'status',
      label: 'Status',
      placeholder: 'All statuses',
      getValue: (row) => row.status,
      options: statusOptions,
    },
  ];
}

const withStatus = (status: IntegrationStatus) => ({
  filters: { ...EMPTY_FILTERS, select: { status } },
  search: '',
});

/** Views the integrations list ships with; the first is the default. */
export const INTEGRATION_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All integrations',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'connected', name: 'Connected', builtIn: true, state: withStatus('CONNECTED') },
  { id: 'disconnected', name: 'Disconnected', builtIn: true, state: withStatus('DISCONNECTED') },
  { id: 'error', name: 'Error', builtIn: true, state: withStatus('ERROR') },
];

/**
 * The columns.
 *
 * The name cell links to the detail page, matching the previous bespoke table.
 * The actions column is pinned and always visible, with a kebab menu whose
 * items are gated by the caller's permission flags.
 */
export function buildIntegrationColumns({
  canManage,
  canUpdate,
  canDelete,
  testingId,
  onOpen,
  onTest,
  onEdit,
  onDelete,
}: {
  readonly canManage: boolean;
  readonly canUpdate: boolean;
  readonly canDelete: boolean;
  readonly testingId: string | undefined;
  readonly onOpen: (integration: IntegrationSummary) => void;
  readonly onTest: (integration: IntegrationSummary) => void;
  readonly onEdit: (integration: IntegrationSummary) => void;
  readonly onDelete: (integration: IntegrationSummary) => void;
}): readonly DataTableColumn<IntegrationSummary>[] {
  return [
    {
      id: 'name',
      header: 'Name',
      sortValue: (integration) => integration.name,
      cell: (integration) => (
        <div className="flex flex-col">
          <Link
            href={`/setup/integrations/${integration.id}`}
            className="font-medium hover:underline"
          >
            {integration.name}
          </Link>
          {!integration.isEnabled && (
            <Badge variant="outline" className="mt-0.5 w-fit">
              Disabled
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'key',
      header: 'Key',
      sortValue: (integration) => integration.key,
      cell: (integration) => <span className="font-mono text-xs">{integration.key}</span>,
    },
    {
      id: 'kind',
      header: 'Kind',
      sortValue: (integration) => integration.kind,
      cell: (integration) => KIND_LABELS[integration.kind],
    },
    {
      id: 'provider',
      header: 'Provider',
      sortValue: (integration) => integration.provider,
      cell: (integration) => integration.provider,
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (integration) => integration.status,
      cell: (integration) => (
        <Badge variant={statusBadgeVariant(integration.status)}>{integration.status}</Badge>
      ),
    },
    {
      id: 'lastChecked',
      header: 'Last checked',
      sortValue: (integration) => integration.lastCheckedAt ?? '',
      responsive: 'hidden lg:table-cell',
      cellClassName: 'whitespace-nowrap tabular-nums text-muted-foreground',
      cell: (integration) => formatTimestamp(integration.lastCheckedAt),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (integration) => (
        <IntegrationRowMenu
          integration={integration}
          canManage={canManage}
          canUpdate={canUpdate}
          canDelete={canDelete}
          testing={testingId === integration.id}
          onOpen={onOpen}
          onTest={onTest}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ),
    },
  ];
}
