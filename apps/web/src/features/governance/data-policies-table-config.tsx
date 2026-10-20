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
import { Trash2 } from 'lucide-react';
import type { DataPolicySummary } from '@hris/shared-types';

export const DATA_POLICY_VIEWS_STORAGE_KEY = 'hris:data-policies:views';

export const DATA_POLICY_SEARCH_TEXT = (policy: DataPolicySummary): string =>
  `${policy.name} ${policy.classification} ${policy.targetResource} ${policy.maskingAction}`;

export function buildDataPolicyFilters(
  rows: readonly DataPolicySummary[],
): readonly DataTableFilter<DataPolicySummary>[] {
  const classifications = [...new Set(rows.map((p) => p.classification))].sort();
  return [
    {
      kind: 'select',
      id: 'classification',
      label: 'Classification',
      placeholder: 'All classifications',
      getValue: (policy) => policy.classification,
      options: classifications.map((c) => ({ value: c, label: c })),
    },
    {
      kind: 'select',
      id: 'state',
      label: 'State',
      placeholder: 'All states',
      getValue: (policy) => (policy.isEnabled ? 'ENABLED' : 'DISABLED'),
      options: [
        { value: 'ENABLED', label: 'Enabled' },
        { value: 'DISABLED', label: 'Disabled' },
      ],
    },
  ];
}

export const DATA_POLICY_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All policies',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
];

export function buildDataPolicyColumns({
  onDelete,
}: {
  readonly onDelete: (policy: DataPolicySummary) => void;
}): readonly DataTableColumn<DataPolicySummary>[] {
  return [
    {
      id: 'name',
      header: 'Name',
      sortValue: (policy) => policy.name,
      cell: (policy) => <span className="font-medium">{policy.name}</span>,
    },
    {
      id: 'classification',
      header: 'Classification',
      sortValue: (policy) => policy.classification,
      cellClassName: 'font-mono text-sm',
      cell: (policy) => policy.classification,
    },
    {
      id: 'resource',
      header: 'Resource',
      sortValue: (policy) => policy.targetResource,
      cellClassName: 'font-mono text-sm',
      cell: (policy) => policy.targetResource,
    },
    {
      id: 'masking',
      header: 'Masking',
      sortValue: (policy) => policy.maskingAction,
      cellClassName: 'font-mono text-sm',
      cell: (policy) => policy.maskingAction,
    },
    {
      id: 'state',
      header: 'State',
      sortValue: (policy) => (policy.isEnabled ? 'ENABLED' : 'DISABLED'),
      cell: (policy) => (
        <Badge variant={policy.isEnabled ? 'success' : 'secondary'}>
          {policy.isEnabled ? 'ENABLED' : 'DISABLED'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      align: 'right',
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (policy) => (
        <Button variant="outline" size="sm" onClick={() => onDelete(policy)}>
          <Trash2 className="mr-1 size-4" aria-hidden />
          Delete
        </Button>
      ),
    },
  ];
}
