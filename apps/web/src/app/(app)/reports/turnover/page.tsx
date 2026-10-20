import type { Metadata } from 'next';

import { TurnoverScreen } from '@/features/reports/turnover-screen';
import { getEmployeeRepository } from '@/features/employees';
import { mockOffboardingRepository } from '@/features/offboarding/mock-offboarding-repository';
import { MAX_PAGE_SIZE } from '@hris/shared-types';

export const metadata: Metadata = { title: 'Employee Turnover Report' };

export const dynamic = 'force-dynamic';

/**
 * The employee turnover report page.
 *
 * Fetches the live employee rows and the mock offboarding cases, then hands
 * them to the client screen which derives attrition figures. The employee
 * data is live; the offboarding cases are the demo repository until the
 * offboarding endpoint ships.
 */
export default async function TurnoverReportPage() {
  const repository = getEmployeeRepository();
  const page = await repository.list({ page: { limit: MAX_PAGE_SIZE } });
  const offboardingCases = await mockOffboardingRepository.listCases({});

  return (
    <TurnoverScreen
      employees={page.items}
      exitReasons={offboardingCases.items.map((c) => ({ reason: c.reason }))}
    />
  );
}
