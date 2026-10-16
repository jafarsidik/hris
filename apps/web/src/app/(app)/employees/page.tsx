import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  parseEmployeeListParams,
  toEmployeeQuery,
  toInitialFilterState,
  toInitialSort,
} from '@/features/employees/employee-query';
import { EmployeeDirectory } from '@/features/employees/employee-directory';
import { getEmployeeRepository } from '@/features/employees';
import { MAX_PAGE_SIZE } from '@hris/shared-types';
import { Info } from 'lucide-react';

/** Employee data is per-user and per-tenant; never let it sit in a shared cache. */
export const dynamic = 'force-dynamic';

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

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

  return (
    <PageBody>
      <PageHeader
        title="Employees"
        description="Search the directory, filter by status, department or type, and save views you come back to."
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
          create, edit or import stays in an in-memory store for this server run and is gone when it
          restarts.
        </AlertDescription>
      </Alert>

      <EmployeeDirectory
        initialRows={page.items}
        initialFilters={toInitialFilterState(params)}
        initialSearch={params.search ?? ''}
        initialSort={toInitialSort(params)}
        initialCreateOpen={autoCreate}
      />
    </PageBody>
  );
}
