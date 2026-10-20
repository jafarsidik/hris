import type { Metadata } from 'next';

import { HeadcountScreen } from '@/features/reports/headcount-screen';
import { getEmployeeRepository } from '@/features/employees';
import { MAX_PAGE_SIZE } from '@hris/shared-types';

export const metadata: Metadata = { title: 'Headcount Report' };

export const dynamic = 'force-dynamic';

/**
 * The headcount report page.
 *
 * Fetches the employee rows and hands them to the client screen, which derives
 * all breakdowns and KPIs. The fetch is per-user and per-tenant, so the page
 * is never cached.
 */
export default async function HeadcountReportPage() {
  const repository = getEmployeeRepository();
  const page = await repository.list({ page: { limit: MAX_PAGE_SIZE } });

  return <HeadcountScreen initialRows={page.items} />;
}
