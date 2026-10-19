import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import {
  parseEmployeeListParams,
  toEmployeeQuery,
  toInitialFilterState,
  toInitialSort,
} from '@/features/employees/employee-query';
import { EmployeeDirectory } from '@/features/employees/employee-directory';
import { getEmployeeRepository } from '@/features/employees';
import { serverApiRequestV1 } from '@/lib/api/server-config';
import { sessionRequestOptions } from '@/lib/api/server-session';
import type { PositionSummary } from '@hris/shared-types';
import { MAX_PAGE_SIZE } from '@hris/shared-types';

import type { OrganizationalUnitSummary } from '@hris/shared-types';
import type { DirectoryOptions } from '@/features/employees/employee-directory-options';

/** Employee data is per-user and per-tenant; never let it sit in a shared cache. */
export const dynamic = 'force-dynamic';

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

interface ListPage<T> {
  readonly items: readonly T[];
}

async function readOptions(): Promise<DirectoryOptions> {
  const options = await sessionRequestOptions({ headers: { 'cache-control': 'no-store' } });
  const [units, positions] = await Promise.all([
    serverApiRequestV1<ListPage<OrganizationalUnitSummary>>(
      '/organization/units?limit=100',
      options,
    ),
    serverApiRequestV1<ListPage<PositionSummary>>('/employees/positions?limit=100', options),
  ]);
  return {
    units: units.items
      .filter((unit) => unit.type === 'DEPARTMENT')
      .map((unit) => ({ id: unit.id, name: unit.name })),
    positions: positions.items
      .filter((position) => position.isActive)
      .map((position) => ({
        id: position.id,
        name: position.name,
        unitId: position.organizationalUnitId,
      })),
  };
}

/** The dialog degrades to free text when the vocabulary cannot be fetched. */
async function directoryOptions(): Promise<DirectoryOptions | null> {
  try {
    return await readOptions();
  } catch {
    return null;
  }
}

/**
 * The directory page.
 *
 * The server's only job is the first paint: read the URL's initial filters, hand them
 * to the repository to fetch the candidate rows, and pass both to the directory. Every
 * interaction after that — search, sorting, paging, column visibility, saved views,
 * selection — belongs to the client-side table, so a keystroke never round-trips.
 *
 * The candidate window is fetched at {@link MAX_PAGE_SIZE}: the platform pages by keyset
 * with no total count, and the table pages over the rows it actually holds. When the
 * real endpoint serves more than a window, a server page gets that "load more" affordance
 * later; this build ships the client UI over the window and says so in Known Limitations.
 */
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}) {
  const resolved = await searchParams;
  const params = parseEmployeeListParams(resolved);
  const autoCreate = firstValue(resolved['action']) === 'new';

  const page = await getEmployeeRepository().list({
    ...toEmployeeQuery(params),
    page: { limit: MAX_PAGE_SIZE },
  });

  const directoryChoices = await directoryOptions();

  return (
    <PageBody>
      <PageHeader
        title="Employees"
        description="Search the directory, filter by status, department or type, and save views you come back to."
      />

      <EmployeeDirectory
        units={directoryChoices?.units}
        positions={directoryChoices?.positions}
        initialRows={page.items}
        initialFilters={toInitialFilterState(params)}
        initialSearch={params.search ?? ''}
        initialSort={toInitialSort(params)}
        initialCreateOpen={autoCreate}
      />
    </PageBody>
  );
}
