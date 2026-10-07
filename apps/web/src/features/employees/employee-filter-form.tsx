import type { EmployeeSort } from '@/features/employees/employee-types';
import { Search } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * The directory's filter controls.
 *
 * A plain `GET` form, not a controlled client component. That is a deliberate choice: it
 * means filtering works with JavaScript unavailable, the state lives in the URL so a
 * filtered directory can be linked and reloaded, and the browser's back button steps
 * through filter changes because each one is a real navigation.
 *
 * The alternative — tracking filters in client state and refetching — needs a component
 * tree that suspends on every keystroke, and loses all three properties above.
 */

const STATUS_OPTIONS: Readonly<Record<string, string>> = {
  ALL: 'All statuses',
  ACTIVE: 'Active',
  ON_LEAVE: 'On leave',
  PROBATION: 'Probation',
  INACTIVE: 'Inactive',
};

/**
 * Sort labels state the direction, because the order is fixed by the keyset index and a
 * reader cannot infer it. `hireDate` is ascending: the sort key is the date itself, not
 * a negated one, so flipping the direction later means adding a descending key rather
 * than reversing the existing one.
 */
const SORT_OPTIONS: Readonly<Record<EmployeeSort, string>> = {
  name: 'Name (A–Z)',
  hireDate: 'Hire date (oldest first)',
};

const PAGE_SIZES = [10, 20, 50] as const;

export interface EmployeeFilters {
  readonly search: string;
  readonly status: string;
  readonly sort: EmployeeSort;
  readonly limit: number;
}

export function EmployeeFilterForm({ filters }: { filters: EmployeeFilters }) {
  const isFiltered = filters.search !== '' || filters.status !== 'ALL' || filters.sort !== 'name';

  return (
    <form
      method="GET"
      action="/employees"
      className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="filter-search">Search</Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="filter-search"
              name="search"
              type="search"
              defaultValue={filters.search}
              placeholder="Name, email or employee no."
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-status">Status</Label>
          <Select name="status" defaultValue={filters.status}>
            <SelectTrigger id="filter-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_OPTIONS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-sort">Sort</Label>
          <Select name="sort" defaultValue={filters.sort}>
            <SelectTrigger id="filter-sort" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_OPTIONS) as EmployeeSort[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {SORT_OPTIONS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-limit">Rows per page</Label>
          <Select name="limit" defaultValue={String(filters.limit)}>
            <SelectTrigger id="filter-limit" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit">Apply</Button>
        {isFiltered && (
          <Button
            type="button"
            variant="ghost"
            // Base UI assumes a `<button>` and warns when one renders as an anchor. An
            // anchor that navigates has no business claiming button semantics.
            nativeButton={false}
            render={<Link href="/employees" />}
          >
            Clear filters
          </Button>
        )}
      </div>
    </form>
  );
}
