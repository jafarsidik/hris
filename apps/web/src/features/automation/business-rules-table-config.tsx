import {
  EMPTY_FILTERS,
  PINNED_ACTIONS_CELL_CLASS,
  PINNED_ACTIONS_HEADER_CLASS,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableView,
} from '@/components/data-table';

import { Badge } from '@/components/ui/badge';
import type { BusinessRuleSummary } from '@hris/shared-types';
import { BusinessRuleRowMenu } from './business-rule-row-menu';

/**
 * The business-rules table's contract: which columns it shows, how it filters, and which
 * views it offers. Kept apart from the screen so the screen stays about behaviour, the
 * same split the users and roles lists use.
 *
 * The list used to be a hand-rolled `<table>` inside a card, with a skeleton and an empty
 * state the screen owned. It now uses the shared table, so it gains sorting, filtering,
 * column visibility, saved views and a pinned row menu at once.
 */

export const BUSINESS_RULE_VIEWS_STORAGE_KEY = 'hris:business-rules:views';

/** The free text a row matches against. */
export const BUSINESS_RULE_SEARCH_TEXT = (rule: BusinessRuleSummary): string =>
  [rule.name, rule.eventType, rule.description ?? ''].join(' ');

const STATE_LABEL = { ENABLED: 'Enabled', DISABLED: 'Disabled' } as const;

/**
 * The filters the toolbar shows.
 *
 * Both states are always offered, even when every rule is in one of them: the filter is
 * how a reader looks for a category, and hiding a category because it is empty answers
 * "nothing here" with "no such thing".
 */
export function buildBusinessRuleFilters(
  rows: readonly BusinessRuleSummary[],
): readonly DataTableFilter<BusinessRuleSummary>[] {
  void rows;

  return [
    {
      kind: 'select',
      id: 'state',
      label: 'State',
      placeholder: 'All states',
      getValue: (rule) => (rule.isEnabled ? 'ENABLED' : 'DISABLED'),
      options: [
        { value: 'ENABLED', label: STATE_LABEL.ENABLED },
        { value: 'DISABLED', label: STATE_LABEL.DISABLED },
      ],
    },
  ];
}

const withState = (state: 'ENABLED' | 'DISABLED') => ({
  filters: { ...EMPTY_FILTERS, select: { state } },
  search: '',
});

/** Views the rules list ships with; the first is the default. */
export const BUSINESS_RULE_BUILT_IN_VIEWS: readonly DataTableView[] = [
  {
    id: 'all',
    name: 'All rules',
    builtIn: true,
    default: true,
    state: { filters: EMPTY_FILTERS, search: '' },
  },
  { id: 'enabled', name: 'Enabled', builtIn: true, state: withState('ENABLED') },
  { id: 'disabled', name: 'Disabled', builtIn: true, state: withState('DISABLED') },
];

/**
 * The columns.
 *
 * `onToggle` and `onDelete` are optional on purpose: a reader without `workflow.manage`
 * gets no actions column at all, rather than a column of controls that are disabled or
 * that silently do nothing. The menu itself is the only writer, so the permission
 * question is asked once, by the screen.
 */
export function buildBusinessRuleColumns({
  onToggle,
  onDelete,
}: {
  onToggle?: (rule: BusinessRuleSummary) => void;
  onDelete?: (rule: BusinessRuleSummary) => void;
}): readonly DataTableColumn<BusinessRuleSummary>[] {
  const columns: DataTableColumn<BusinessRuleSummary>[] = [
    {
      id: 'name',
      header: 'Name',
      sortValue: (rule) => rule.name,
      cellClassName: 'font-medium',
      cell: (rule) => rule.name,
    },
    {
      id: 'trigger',
      header: 'Trigger',
      sortValue: (rule) => rule.eventType,
      cellClassName: 'font-mono text-sm',
      cell: (rule) => rule.eventType,
    },
    {
      id: 'actionCount',
      header: 'Actions',
      sortValue: (rule) => rule.actions.length,
      cellClassName: 'text-muted-foreground',
      cell: (rule) => rule.actions.length,
    },
    {
      id: 'priority',
      header: 'Priority',
      sortValue: (rule) => rule.priority,
      cellClassName: 'font-mono',
      cell: (rule) => rule.priority,
    },
    {
      id: 'state',
      header: 'State',
      sortValue: (rule) => (rule.isEnabled ? 'ENABLED' : 'DISABLED'),
      cell: (rule) => (
        <Badge variant={rule.isEnabled ? 'success' : 'secondary'}>
          {rule.isEnabled ? 'ENABLED' : 'DISABLED'}
        </Badge>
      ),
    },
  ];

  if (onToggle !== undefined && onDelete !== undefined) {
    columns.push({
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      hideable: false,
      headerClassName: PINNED_ACTIONS_HEADER_CLASS,
      cellClassName: PINNED_ACTIONS_CELL_CLASS,
      cell: (rule) => <BusinessRuleRowMenu rule={rule} onToggle={onToggle} onDelete={onDelete} />,
    });
  }

  return columns;
}
