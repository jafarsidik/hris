import {
  EMPTY_FILTERS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';

import { Badge } from '@/components/ui/badge';
import {
  INTEGRATION_DELIVERY_DIRECTIONS,
  INTEGRATION_DELIVERY_STATUSES,
  type IntegrationDeliveryStatus,
  type IntegrationDeliverySummary,
} from '@hris/shared-types';

import { deliveryBadgeVariant, formatTimestamp } from './integration-presentation';

export const DELIVERY_VIEWS_STORAGE_KEY = 'hris:integration-deliveries:views';

/** The free text a row matches against. */
export const DELIVERY_SEARCH_TEXT = (delivery: IntegrationDeliverySummary): string =>
  `${delivery.operation} ${delivery.direction} ${delivery.status} ${delivery.error ?? ''}`;

/**
 * The filters the toolbar shows.
 *
 * Both status and direction vocabularies are always offered, even when the rows
 * carry only one value — the same rule the integrations list follows.
 */
export function buildDeliveryFilters(
  rows: readonly IntegrationDeliverySummary[],
): readonly DataTableFilter<IntegrationDeliverySummary>[] {
  const present = new Set<IntegrationDeliveryStatus>([
    ...INTEGRATION_DELIVERY_STATUSES,
    ...rows.map((row) => row.status),
  ]);
  const statusOptions = [...present].map((status) => ({ value: status, label: status }));

  const directionOptions = INTEGRATION_DELIVERY_DIRECTIONS.map((direction) => ({
    value: direction,
    label: direction,
  }));

  return [
    {
      kind: 'select',
      id: 'status',
      label: 'Status',
      placeholder: 'All statuses',
      getValue: (row) => row.status,
      options: statusOptions,
    },
    {
      kind: 'select',
      id: 'direction',
      label: 'Direction',
      placeholder: 'All directions',
      getValue: (row) => row.direction,
      advanced: true,
      options: directionOptions,
    },
  ];
}

const withStatus = (status: IntegrationDeliveryStatus) => ({
  filters: { ...EMPTY_FILTERS, select: { status } },
  search: '',
});

/** Views the delivery log ships with; the first is the default. */
export const DELIVERY_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All deliveries',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'succeeded', name: 'Succeeded', builtIn: true, state: withStatus('SUCCEEDED') },
  { id: 'failed', name: 'Failed', builtIn: true, state: withStatus('FAILED') },
  { id: 'retrying', name: 'Retrying', builtIn: true, state: withStatus('RETRYING') },
];

/**
 * The columns.
 *
 * Deliveries are read-only records — no row actions, no selection.
 */
export function buildDeliveryColumns(): readonly DataTableColumn<IntegrationDeliverySummary>[] {
  return [
    {
      id: 'when',
      header: 'When',
      sortValue: (delivery) => delivery.createdAt,
      cellClassName: 'whitespace-nowrap text-muted-foreground',
      cell: (delivery) => formatTimestamp(delivery.createdAt),
    },
    {
      id: 'direction',
      header: 'Direction',
      sortValue: (delivery) => delivery.direction,
      cell: (delivery) => delivery.direction,
    },
    {
      id: 'operation',
      header: 'Operation',
      sortValue: (delivery) => delivery.operation,
      cellClassName: 'font-mono text-xs',
      cell: (delivery) => delivery.operation,
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (delivery) => delivery.status,
      cell: (delivery) => (
        <Badge variant={deliveryBadgeVariant(delivery.status)}>{delivery.status}</Badge>
      ),
    },
    {
      id: 'attempt',
      header: 'Attempt',
      sortValue: (delivery) => delivery.attempt,
      align: 'right',
      cellClassName: 'tabular-nums',
      cell: (delivery) => delivery.attempt,
    },
    {
      id: 'duration',
      header: 'Duration',
      sortValue: (delivery) => delivery.durationMs ?? 0,
      align: 'right',
      cellClassName: 'tabular-nums',
      cell: (delivery) => (delivery.durationMs === null ? '—' : `${delivery.durationMs} ms`),
    },
    {
      id: 'error',
      header: 'Error',
      sortValue: (delivery) => delivery.error ?? '',
      responsive: 'hidden lg:table-cell',
      cellClassName: 'max-w-[24rem] text-muted-foreground',
      cell: (delivery) => (
        <span className="block truncate" title={delivery.error ?? undefined}>
          {delivery.error ?? '—'}
        </span>
      ),
    },
  ];
}
