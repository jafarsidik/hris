import { PageHeader } from '@/components/layout/page-header';
import {
  EmployeeFilterForm,
  type EmployeeFilters,
} from '@/features/employees/employee-filter-form';
import { EmployeeDirectory } from '@/features/employees/employee-directory';
import type { EmployeeSort } from '@/features/employees/employee-types';
import { getEmployeeRepository } from '@/features/employees';
import { DEFAULT_PAGE_SIZE } from '@hris/shared-types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

/** Employee data is per-user and per-tenant; never let it sit in a shared cache. */
export const dynamic = 'force-dynamic';

/**
 * Parses one query parameter.
 *
 * `searchParams` values are `string | string[] | undefined`. A repeated parameter arrives
 * as an array, so the first entry is taken rather than letting an array reach the filter
 * and match nothing — a URL like `?status=ACTIVE&status=ON_LEAVE` should narrow, not
 * silently return an empty directory.
 */
const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const SORTS: readonly EmployeeSort[] = ['name', 'hireDate'];
const PAGE_SIZES = [10, 20, 50] as const;

function parseFilters(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
): EmployeeFilters {
  const rawSort = firstValue(searchParams['sort']);
  const rawStatus = firstValue(searchParams['status']);
  const rawLimit = firstValue(searchParams['limit']);

  const limit = Number(rawLimit);
  const parsedLimit = PAGE_SIZES.find((size) => size === limit) ?? DEFAULT_PAGE_SIZE;

  return {
    search: (firstValue(searchParams['search']) ?? '').slice(0, 200),
    status: rawStatus !== undefined && rawStatus !== '' ? rawStatus : 'ALL',
    sort: SORTS.find((sort) => sort === rawSort) ?? 'name',
    limit: parsedLimit,
  };
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}) {
  const resolved = await searchParams;
  const filters = parseFilters(resolved);
  const autoCreate = firstValue(resolved['action']) === 'new';

  const page = await getEmployeeRepository().list({
    search: filters.search === '' ? undefined : filters.search,
    status: filters.status,
    sort: filters.sort,
    page: { limit: filters.limit },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Search the directory, filter by status, and page through the results."
      />

      {/*
        Stated on the screen rather than left for the reader to infer. These rows are
        generated locally: the employee endpoint does not exist yet, so a screenshot of
        this page must not be mistaken for a working feature.
      */}
      <Alert>
        <Info aria-hidden="true" />
        <AlertTitle>Sample data</AlertTitle>
        <AlertDescription>
          These are generated records, not real people. The employee endpoint is not built yet, so a
          create or edit stays in an in-memory store for this server run and is gone when it
          restarts.
        </AlertDescription>
      </Alert>

      <EmployeeFilterForm filters={filters} />

      <EmployeeDirectory
        // Remounting on a filter change is the reset. Rows paged in under the previous
        // filters are meaningless under the new ones, and reconciling them with an
        // effect risks a frame of stale rows; a new key makes the old state unreachable.
        key={`${filters.search}|${filters.status}|${filters.sort}|${filters.limit}|${autoCreate}`}
        initialPage={page}
        filters={{
          search: filters.search,
          status: filters.status,
          sort: filters.sort,
        }}
        initialCreateOpen={autoCreate}
      />
    </div>
  );
}
