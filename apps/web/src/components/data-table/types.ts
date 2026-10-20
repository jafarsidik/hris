import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The contract every list of rows renders against.
 *
 * The employees directory is the first consumer; recruitment, attendance, leave,
 * claims and payroll are meant to share it. A column is presentation and everything
 * the component needs to derive from the row without touching the record's own
 * shape — sorting has to read a scalar value, so it is declared as `sortValue`
 * rather than guessed from what the cell renders.
 */
export interface DataTableColumn<TRow extends { readonly id: string }> {
  readonly id: string;
  readonly header: ReactNode;
  readonly cell: (row: TRow) => ReactNode;
  /** The scalar the column sorts by. Absent means the column cannot be sorted. */
  readonly sortValue?: (row: TRow) => string | number;
  /** Visible by default; every column can be hidden from the toggle. */
  readonly defaultVisible?: boolean;
  /** A column that must always render, such as the row actions menu. Default false. */
  readonly hideable?: boolean;
  /** Responsive classes, e.g. `"hidden lg:table-cell"`. Default stays on all widths. */
  readonly responsive?: string;
  readonly headerClassName?: string;
  readonly cellClassName?: string;
  /**
   * Horizontal alignment. `center` exists because a badge or a short enum code reads as a
   * column of its own when it is centred, which is how the settings catalogue and the roles
   * type column were drawn before they moved onto this table.
   */
  readonly align?: 'left' | 'right' | 'center';
}

export interface DataTableOption {
  readonly value: string;
  readonly label: string;
}

/** A dropdown filter whose active value must equal a row field. */
export interface DataTableSelectFilter<TRow extends { readonly id: string }> {
  readonly kind: 'select';
  readonly id: string;
  readonly label: string;
  /** Shown in the collapsed trigger when nothing is selected, e.g. "All departments". */
  readonly placeholder: string;
  readonly options: readonly DataTableOption[];
  readonly getValue: (row: TRow) => string;
  /** Lives under "More filters" rather than in the toolbar row. */
  readonly advanced?: boolean;
}

/** An inclusive from/to filter over a comparable scalar, such as an ISO date. */
export interface DataTableRangeFilter<TRow extends { readonly id: string }> {
  readonly kind: 'range';
  readonly id: string;
  readonly label: string;
  readonly fromLabel: string;
  readonly toLabel: string;
  /** The value to range over, e.g. an ISO `YYYY-MM-DD` hire date. */
  readonly getValue: (row: TRow) => string;
}

export type DataTableFilter<TRow extends { readonly id: string }> =
  DataTableSelectFilter<TRow> | DataTableRangeFilter<TRow>;

export type FilterRange = { readonly from?: string; readonly to?: string };

export interface FilterState {
  /** `filter id` → selected value; `''` (or absent) means "all". */
  readonly select: Readonly<Record<string, string>>;
  /** `filter id` → inclusive bounds. */
  readonly ranges: Readonly<Record<string, FilterRange>>;
}

export const EMPTY_FILTERS: FilterState = { select: {}, ranges: {} };

export interface DataTableSortState {
  readonly columnId: string;
  readonly direction: 'asc' | 'desc';
}

export interface DataTableBulkAction<TRow extends { readonly id: string }> {
  readonly id: string;
  readonly label: string;
  readonly icon?: LucideIcon;
  /** A bulk action the backend cannot perform yet is honest about it. */
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  /** The action body; absent for actions that are disabled this build. */
  readonly run?: (rows: readonly TRow[], clearSelection: () => void) => void;
}

export interface DataTableViewState {
  readonly filters?: FilterState;
  readonly search?: string;
  readonly sort?: DataTableSortState;
  readonly pageSize?: number;
  /** `column id` → visible. Only ids present in the map are counted. */
  readonly columns?: Readonly<Record<string, boolean>>;
}

export interface DataTableView {
  readonly id: string;
  readonly name: string;
  readonly builtIn?: boolean;
  readonly default?: boolean;
  readonly state: DataTableViewState;
}

export interface DataTableViewsConfig {
  /** Views offered without any persistence, such as "Active employees". */
  readonly builtIn: readonly DataTableView[];
  /** localStorage key under which saved views and the default view persist. */
  readonly storageKey: string;
}
