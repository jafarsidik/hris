import { EMPTY_FILTERS, type DataTableViewState } from './types';

/**
 * Where saved views live between sessions.
 *
 * localStorage is the smallest thing that gives views a lifetime beyond the page,
 * and it matches the platform rule of not inventing persistence the backend does
 * not have yet. Every touch is guarded: storage can be disabled entirely (private
 * browsing, a test environment that stubs nothing), so a view that cannot be saved
 * must degrade to "uses the in-memory view" rather than crashing the table.
 */

export interface PersistedView {
  readonly id: string;
  readonly name: string;
  readonly state: DataTableViewState;
  /** Which saved view opens by default; at most one has this set. */
  readonly default?: boolean;
}

export const DEFAULT_VIEW_ID = 'all';

export function loadPersistedViews(key: string): readonly PersistedView[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PersistedView[]) : [];
  } catch {
    return [];
  }
}

export function savePersistedViews(key: string, views: readonly PersistedView[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(views));
  } catch {
    // No persistence is available; the in-memory list still works for this visit.
  }
}

/** A view with no filters, sort or paging — the plain "All employees" directory. */
export const ALL_ROWS_VIEW_STATE: DataTableViewState = {
  filters: EMPTY_FILTERS,
  search: '',
};
