import type { Metadata } from 'next';

import { WorkforceScreen } from '@/features/reports/workforce-screen';
import { getEmployeeRepository } from '@/features/employees';
import { MAX_PAGE_SIZE } from '@hris/shared-types';

export const metadata: Metadata = { title: 'Workforce Report' };

export const dynamic = 'force-dynamic';

/**
 * The workforce report page.
 *
 * Fetches the employee rows and hands them to the client screen, which derives
 * the combined summary: headcount, distribution, joiners, tenure and status mix.
 */
export default async function WorkforceReportPage() {
  const repository = getEmployeeRepository();
  const page = await repository.list({ page: { limit: MAX_PAGE_SIZE } });

  return <WorkforceScreen initialRows={page.items} />;
}
